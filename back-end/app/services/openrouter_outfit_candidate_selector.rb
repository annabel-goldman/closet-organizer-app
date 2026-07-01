require "base64"
require "json"
require "net/http"
require "uri"

class OpenrouterOutfitCandidateSelector
  DEFAULT_BASE_URL = "https://openrouter.ai/api/v1".freeze
  DEFAULT_MODEL = "openai/gpt-4.1-mini".freeze
  MAX_CONTEXT_TAGS = 10
  MAX_CONTEXT_STYLE_NOTES = 240

  def self.call(items:, occasion: nil, max_candidates: OpenrouterOutfitGenerator::MAX_CANDIDATE_ITEMS, reference_photo: nil, reference_profile: nil, preference_context: nil)
    new(
      items: items,
      occasion: occasion,
      max_candidates: max_candidates,
      reference_photo: reference_photo,
      reference_profile: reference_profile,
      preference_context: preference_context
    ).call
  end

  def initialize(items:, occasion: nil, max_candidates: OpenrouterOutfitGenerator::MAX_CANDIDATE_ITEMS, reference_photo: nil, reference_profile: nil, preference_context: nil)
    @items = Array(items)
    @occasion = occasion.to_s.strip.presence
    @max_candidates = Integer(max_candidates)
    @reference_photo = reference_photo
    @reference_profile = reference_profile
    @preference_context = preference_context
  end

  def call
    ensure_configuration!

    parsed = perform_structured_request
    candidate_ids = normalize_item_ids(parsed.fetch("candidate_item_ids", []))
    raise "OpenRouter did not select any valid candidate items." if candidate_ids.empty?

    candidate_ids
  end

  private

  attr_reader :items, :occasion, :max_candidates, :reference_photo, :reference_profile, :preference_context

  def perform_structured_request
    uri = URI.parse("#{base_url}/chat/completions")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = (uri.scheme == "https")
    http.read_timeout = 35
    http.open_timeout = 10

    request = Net::HTTP::Post.new(uri)
    request["Authorization"] = "Bearer #{api_key}"
    request["Content-Type"] = "application/json"
    request["HTTP-Referer"] = ENV["OPENROUTER_SITE_URL"] if ENV["OPENROUTER_SITE_URL"].present?
    request["X-Title"] = ENV["OPENROUTER_APP_NAME"] if ENV["OPENROUTER_APP_NAME"].present?
    request.body = request_body.to_json

    response = http.request(request)
    parsed = JSON.parse(response.body)

    return parse_json_payload(extract_message_content(parsed)) if response.is_a?(Net::HTTPSuccess)

    error_message = parsed.dig("error", "message") || "OpenRouter request failed with status #{response.code}"
    raise error_message
  rescue JSON::ParserError
    raise "OpenRouter returned an unreadable outfit response."
  end

  def request_body
    {
      model: configured_model,
      temperature: 0.25,
      max_tokens: 500,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "outfit_candidate_items",
          strict: true,
          schema: response_schema
        }
      },
      messages: [
        {
          role: "system",
          content: "You are a fashion styling assistant. Return only valid JSON."
        },
        {
          role: "user",
          content: request_content
        }
      ]
    }
  end

  def response_schema
    {
      type: "object",
      additionalProperties: false,
      required: %w[candidate_item_ids],
      properties: {
        candidate_item_ids: {
          type: "array",
          minItems: 1,
          maxItems: max_candidates,
          items: { type: "integer" }
        }
      }
    }
  end

  def selector_prompt
    occasion_line = occasion.present? ? "User request: #{occasion}" : "User request: shortlist versatile outfit candidates from the closet context."
    reference_line = reference_photo.present? ? "A user-uploaded flatlay reference image is included. Use it to infer the closest matching closet pieces, colors, silhouettes, and outfit structure." : nil
    profile_line = reference_profile.present? ? "A structured reference target profile is included. Use it to preserve both item structure and whole-outfit signature details." : nil
    preference_line = preference_context.present? ? "User feedback history is included. Use it as gentle preference guidance, especially for substitutions the user previously made, but do not force a bad item into the shortlist." : nil

    <<~PROMPT
      Select a broad candidate shortlist for one outfit from the closet items below.

      #{occasion_line}
      #{reference_line}
      #{profile_line}
      #{preference_line}

      Return a JSON object with:
      - candidate_item_ids: 1 to #{max_candidates} item ids from the provided closet items

      Rules:
      - This is not the final outfit. Choose a useful shortlist for visual refinement.
      - Use only ids from the provided closet items.
      - Prefer pieces that could work together by category, color words, tags, brand, and visual descriptions.
      - Treat the item order as random context, not as a recommendation or ranking.
      - Avoid overusing one neutral color family unless the user specifically asks for it.
      - Include enough category variety to build a complete look when the closet supports it.
      - For dress-based looks, include viable footwear candidates when the closet has shoes.
      - For top-based looks, include compatible bottom candidates when the closet has bottoms.
      - When a flatlay reference image is provided, prioritize closet items that look closest to the reference outfit while still making a wearable saved look.
      - When a structured reference target is provided, include strong candidate matches for each required target slot whenever the closet contains them.
      - Also include candidates that preserve signature visual anchors from the reference, such as sequins, satin, burgundy/patent/croc leather, metallic hardware, or a glam mood, even if the matching detail appears on a different garment type than in the reference.
      - A cohesive vibe match can be more useful than a literal slot match; for example, a sequin top may better recreate a sequined-short outfit than plain shorts, and burgundy Mary Janes may better echo burgundy boots than unrelated black boots.
      - When user feedback examples are provided, prefer candidates similar to items the user added or kept in past generated-outfit edits, and be cautious with items they removed or deleted in similar contexts.
      - If the closet includes a bag-like accessory, prefer including a viable bag candidate when it could complement the look.
      - Prefer items with strong style-note relevance to the user's request.
      - Do not invent closet item ids or new clothing pieces.
      - Return only JSON and no markdown.
    PROMPT
  end

  def request_content
    content = [
      {
        type: "text",
        text: selector_prompt
      },
      {
        type: "text",
        text: "Closet items:\n#{items.map { |item| item_context(item) }.join("\n\n")}"
      }
    ]

    if reference_profile.present?
      content << {
        type: "text",
        text: "Structured reference target:\n#{JSON.pretty_generate(reference_profile)}"
      }
    end

    if preference_context.present?
      content << {
        type: "text",
        text: "User generation feedback history:\n#{JSON.pretty_generate(preference_context)}"
      }
    end

    if reference_photo.present?
      content << {
        type: "text",
        text: "Reference flatlay outfit image:"
      }
      content << image_part_for_reference_photo
    end

    content
  end

  def item_context(item)
    lines = [
      "Item #{item.id}:",
      "- name: #{normalized_context_text(item.name)}",
      "- category: #{normalized_context_text(item.category, fallback: 'unknown')}",
      "- brand: #{normalized_context_text(item.brand, fallback: 'unknown')}"
    ]

    tags = TagListNormalizer.call(item.tags).first(MAX_CONTEXT_TAGS)
    lines << "- tags: #{tags.join(', ')}" if tags.present?

    style_notes = normalized_context_text(
      item.style_notes,
      fallback: nil,
      max_length: MAX_CONTEXT_STYLE_NOTES
    )
    lines << "- visual description: #{style_notes}" if style_notes.present?

    lines.join("\n")
  end

  def normalized_context_text(value, fallback: "", max_length: InputLengthPolicy::MAX_CLOTHING_ITEM_NAME)
    text = value.to_s.squish
    text = fallback if text.blank? && !fallback.nil?
    text.truncate(max_length, omission: "...")
  end

  def extract_message_content(response)
    content = response.dig("choices", 0, "message", "content")

    case content
    when String
      content
    when Array
      content.filter_map { |part| part["text"] }.join("\n")
    else
      raise "OpenRouter did not return outfit content."
    end
  end

  def parse_json_payload(content)
    cleaned = content.to_s.strip
    cleaned = cleaned.sub(/\A```json\s*/i, "").sub(/\A```\s*/i, "").sub(/\s*```\z/, "")

    JSON.parse(cleaned)
  rescue JSON::ParserError
    json_start = cleaned.index("{")
    json_end = cleaned.rindex("}")
    raise "OpenRouter returned data that was not valid JSON." unless json_start && json_end

    JSON.parse(cleaned[json_start..json_end])
  end

  def normalize_item_ids(raw_item_ids)
    allowed_ids = items.map(&:id)
    Array(raw_item_ids)
      .filter_map { |value| normalize_item_id(value) }
      .select { |id| allowed_ids.include?(id) }
      .uniq
      .first(max_candidates)
  end

  def normalize_item_id(value)
    Integer(value)
  rescue ArgumentError, TypeError
    nil
  end

  def ensure_configuration!
    raise "OPENROUTER_API_KEY is not configured." if api_key.blank?
  end

  def image_part_for_reference_photo
    {
      type: "image_url",
      image_url: {
        url: reference_photo_data_url
      }
    }
  end

  def reference_photo_data_url
    reference_photo.rewind if reference_photo.respond_to?(:rewind)
    data = reference_photo.read
    reference_photo.rewind if reference_photo.respond_to?(:rewind)
    content_type = reference_photo.respond_to?(:content_type) ? reference_photo.content_type : nil
    "data:#{content_type.presence || 'image/png'};base64,#{Base64.strict_encode64(data)}"
  end

  def api_key
    ENV["OPENROUTER_API_KEY"]
  end

  def base_url
    ENV.fetch("OPENROUTER_BASE_URL", DEFAULT_BASE_URL)
  end

  def configured_model
    ENV.fetch("OPENROUTER_OUTFIT_MODEL", ENV.fetch("OPENROUTER_MODEL", DEFAULT_MODEL))
  end
end
