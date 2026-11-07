require "base64"
require "json"

class OpenrouterOutfitVisualJudge
  DEFAULT_MODEL = "google/gemini-2.5-flash".freeze
  DEFAULT_MAX_OUTPUT_TOKENS = 6_000
  MAX_RESPONSE_ATTEMPTS = 2
  RUBRIC_KEYS = %w[prompt_accuracy role_suitability visual_compatibility personal_taste].freeze
  InvalidJudgmentResponse = Class.new(StandardError)

  def self.highest_ranked(evaluations)
    evaluations.min_by { |evaluation| [ -evaluation.fetch("overall_score"), evaluation.fetch("candidate_id") ] }
  end

  def self.call(brief:, candidates:)
    new(brief: brief, candidates: candidates).call
  end

  def initialize(brief:, candidates:, max_response_attempts: MAX_RESPONSE_ATTEMPTS, max_output_tokens: nil)
    @brief = brief
    @candidates = candidates
    @requested_max_response_attempts = max_response_attempts
    @requested_max_output_tokens = max_output_tokens
  end

  def call
    raise "There are no outfit candidates to judge." if candidates.empty?

    collages = []
    candidates.each { |candidate| collages << OutfitCandidateCollageRenderer.call(candidate.fetch(:items)) }
    response, evaluations, usage = request_evaluations(collages)

    {
      evaluations: evaluations,
      passing: [ self.class.highest_ranked(evaluations) ],
      model: response["model"].presence || configured_model,
      usage: usage.merge("estimated_cost_usd" => estimated_cost(usage)),
      quality_floor: nil
    }
  ensure
    Array(collages).each(&:close!)
  end

  private

  attr_reader :brief, :candidates

  def request_evaluations(collages)
    responses = []

    max_response_attempts.times do |attempt|
      response = client.post_json(
        path: "/chat/completions",
        body: request_body(collages, retrying: attempt.positive?),
        unreadable_message: "OpenRouter returned an unreadable outfit judging response."
      )
      responses << response

      begin
        evaluations = normalize_evaluations(parse_content(response))
        unless evaluated_all?(evaluations)
          raise InvalidJudgmentResponse, "The visual judge did not evaluate every outfit candidate."
        end

        usage = combined_usage(responses.map { |value| value["usage"] || {} })
        return [ response, evaluations, usage.merge("attempts" => responses.length) ]
      rescue InvalidJudgmentResponse => error
        log_invalid_response(response, error, attempt: attempt + 1)
        raise invalid_response_error(response, error) if attempt + 1 == max_response_attempts
      end
    end
  end

  def request_body(collages, retrying: false)
    {
      model: configured_model,
      temperature: 0.1,
      max_tokens: max_output_tokens,
      response_format: {
        type: "json_schema",
        json_schema: { name: "outfit_visual_judgment", strict: true, schema: response_schema }
      },
      messages: [
        {
          role: "system",
          content: "You are a fashion editor ranking available clothing combinations, including incomplete outfits. Return one complete JSON object with concise text and no Markdown."
        },
        { role: "user", content: request_content(collages, retrying: retrying) }
      ]
    }
  end

  def request_content(collages, retrying:)
    content = [
      {
        type: "text",
        text: <<~PROMPT
          Rank these clothing combinations against this suggested styling plan:
          #{brief.to_json}

          Score each rubric dimension from 0 to 100. overall_score must reflect the whole look, not an average of isolated items.
          Score prompt accuracy, specific garment-role suitability, whole-look visual compatibility, and personal taste separately.
          Treat the actual garment images as authoritative. If an image conflicts with an item's name or metadata,
          heavily penalize that candidate for data integrity instead of trusting the text.
          Reject category-complete looks that visibly clash in formality, season, footwear, palette, silhouette, or context.
          Taste examples in the plan are guidance, never permission to override the request.
          Only list explicit user exclusions or missing locked pieces as hard_violations. Aesthetic mismatches, inferred preferences,
          exact-shade compromises, weather, and occasion suitability lower scores; they do not make an outfit invalid.
          Garment roles, props, and the anchor are suggestions, not mandatory prerequisites. Missing props or clothing
          coverage may lower scores but MUST NOT veto a candidate. Always score every candidate, including partial outfits.
          Explain missing pieces honestly; describe the closest available interpretation rather than demanding a literal costume or ideal wardrobe.
          In summary briefly explain the most important concrete compromise, if any. Never claim an exact match where one is absent.
          Return repair_item_id (an existing candidate item ID) and repair_instruction for one correctable mismatch, or null and an empty string.
          Every candidate ID must appear exactly once.
          Keep every title, summary, reason, and violation concise so the complete JSON response is not truncated.
          #{"The previous judging response was malformed. Return only a complete JSON object this time." if retrying}
        PROMPT
      }
    ]
    collages.each_with_index do |collage, index|
      content << { type: "text", text: "Candidate #{candidates[index].fetch(:id)}; pieces: #{candidates[index].fetch(:items).map { |item| { id: item.id, name: item.name, category: item.category } }.to_json}" }
      content << { type: "image_url", image_url: { url: data_url(collage) } }
    end
    content
  end

  def response_schema
    {
      type: "object",
      additionalProperties: false,
      required: %w[evaluations],
      properties: {
        evaluations: {
          type: "array", minItems: 1, maxItems: 6,
          items: {
            type: "object", additionalProperties: false,
            required: [ "candidate_id", *RUBRIC_KEYS, "overall_score", "title", "summary", "reasons", "hard_violations", "repair_item_id", "repair_instruction" ],
            properties: {
              candidate_id: { type: "string" },
              repair_item_id: { type: [ "integer", "null" ] },
              repair_instruction: { type: "string", maxLength: 160 },
              **RUBRIC_KEYS.index_with { { type: "integer", minimum: 0, maximum: 100 } },
              overall_score: { type: "integer", minimum: 0, maximum: 100 },
              title: { type: "string", maxLength: 80 },
              summary: { type: "string", maxLength: 240 },
              reasons: { type: "array", maxItems: 3, items: { type: "string", maxLength: 160 } },
              hard_violations: { type: "array", maxItems: 6, items: { type: "string", maxLength: 180 } }
            }
          }
        }
      }
    }
  end

  def parse_content(response)
    content = response.dig("choices", 0, "message", "content")
    content = content.filter_map { |part| part["text"] }.join("\n") if content.is_a?(Array)
    payload = content.is_a?(Hash) ? content.deep_stringify_keys : parse_json_document(content)
    evaluations = payload["evaluations"]
    unless evaluations.is_a?(Array) && evaluations.all? { |evaluation| evaluation.is_a?(Hash) }
      raise InvalidJudgmentResponse, "The outfit judgment did not contain a valid evaluations list."
    end

    evaluations.map(&:stringify_keys)
  rescue JSON::ParserError
    raise InvalidJudgmentResponse, "OpenRouter returned outfit judgments that were not valid JSON."
  end

  def parse_json_document(content)
    cleaned = content.to_s.strip.sub(/\A```json\s*/i, "").sub(/\A```\s*/i, "").sub(/\s*```\z/, "")
    JSON.parse(cleaned)
  rescue JSON::ParserError
    json_start = cleaned.index("{")
    json_end = cleaned.rindex("}")
    raise unless json_start && json_end

    JSON.parse(cleaned[json_start..json_end])
  end

  def normalize_evaluations(values)
    values.map do |value|
      unless [ *RUBRIC_KEYS, "overall_score" ].all? { |key| value[key].is_a?(Numeric) && value[key].finite? && (0..100).cover?(value[key]) }
        raise InvalidJudgmentResponse, "The outfit judgment contains missing or invalid scores."
      end
      scores = RUBRIC_KEYS.index_with { |key| value[key].to_i.clamp(0, 100) }
      {
        "candidate_id" => value["candidate_id"].to_s,
        "scores" => scores,
        "overall_score" => (scores["prompt_accuracy"] * 0.4 + scores["role_suitability"] * 0.25 + scores["visual_compatibility"] * 0.25 + scores["personal_taste"] * 0.1).round,
        "repair_item_id" => Integer(value["repair_item_id"], exception: false),
        "repair_instruction" => value["repair_instruction"].to_s.truncate(160),
        "title" => value["title"].to_s.squish.truncate(80),
        "summary" => value["summary"].to_s.squish.truncate(300),
        "reasons" => Array(value["reasons"]).map { |reason| reason.to_s.squish }.reject(&:blank?).first(4),
        "hard_violations" => Array(value["hard_violations"]).map { |reason| reason.to_s.squish }.reject(&:blank?).first(8)
      }
    end
  end

  def evaluated_all?(evaluations)
    evaluations.map { |value| value["candidate_id"] }.sort == candidates.map { |value| value.fetch(:id).to_s }.sort
  end

  def data_url(file)
    "data:image/png;base64,#{Base64.strict_encode64(File.binread(file.path))}"
  end

  def max_output_tokens
    requested = @requested_max_output_tokens.presence || ENV.fetch("OUTFIT_JUDGE_MAX_TOKENS", DEFAULT_MAX_OUTPUT_TOKENS)
    Integer(requested).clamp(900, 6_000)
  end

  def max_response_attempts
    Integer(@requested_max_response_attempts).clamp(1, MAX_RESPONSE_ATTEMPTS)
  end

  def combined_usage(values)
    values.each_with_object({}) do |value, combined|
      value.each do |key, entry|
        combined[key] = if entry.is_a?(Numeric)
          combined.fetch(key, 0).to_f + entry
        elsif entry.is_a?(Hash)
          combined_usage([ combined.fetch(key, {}), entry ])
        else
          entry
        end
      end
    end
  end

  def log_invalid_response(response, error, attempt:)
    content = response.dig("choices", 0, "message", "content")
    Rails.logger.warn(
      "Outfit visual judge response invalid " \
      "attempt=#{attempt} response_id=#{response['id'].presence || 'unknown'} " \
      "finish_reason=#{finish_reason(response)} content_length=#{content.to_s.length} error=#{error.message}"
    )
  end

  def invalid_response_error(response, error)
    reason = finish_reason(response)
    message = if reason == "length"
      "OpenRouter truncated the outfit judgments before completing the JSON response."
    else
      "OpenRouter returned invalid outfit judgments after an automatic retry (finish reason: #{reason})."
    end
    RuntimeError.new("#{message} #{error.message}")
  end

  def finish_reason(response)
    response.dig("choices", 0, "finish_reason").presence || "unknown"
  end

  def estimated_cost(usage)
    reported = usage["cost"].presence || usage.dig("cost_details", "upstream_inference_cost")
    return reported.to_f if reported

    input_rate = ENV.fetch("OUTFIT_JUDGE_INPUT_USD_PER_MILLION", "0.30").to_f
    output_rate = ENV.fetch("OUTFIT_JUDGE_OUTPUT_USD_PER_MILLION", "2.50").to_f
    (((usage["prompt_tokens"].to_i * input_rate) + (usage["completion_tokens"].to_i * output_rate)) / 1_000_000.0).round(6)
  end

  def client
    @client ||= OpenrouterClient.new(
      api_key: ENV["OPENROUTER_API_KEY"].presence || raise("OPENROUTER_API_KEY is not configured."),
      base_url: ENV.fetch("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
      read_timeout: 180
    )
  end

  def configured_model
    ENV.fetch("OPENROUTER_OUTFIT_JUDGE_MODEL", DEFAULT_MODEL)
  end
end
