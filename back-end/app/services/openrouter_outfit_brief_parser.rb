require "json"

class OpenrouterOutfitBriefParser
  DEFAULT_MODEL = "google/gemini-2.5-flash".freeze
  CATEGORIES = %w[top bottom dress outerwear shoes accessory intimates swimwear].freeze

  def self.call(prompt, locked_items: [])
    new(prompt, locked_items: locked_items).call
  end

  def initialize(prompt, locked_items: [])
    @prompt = prompt.to_s.squish
    @locked_items = Array(locked_items)
  end

  def call
    raise "Describe the outfit you want." if prompt.blank?

    response = client.post_json(
      path: "chat/completions",
      body: request_body,
      unreadable_message: "OpenRouter returned an unreadable outfit plan."
    )
    normalize(JSON.parse(clean_json(extract_content(response)))).merge(
      "usage" => response["usage"] || {},
      "model" => response["model"].presence || configured_model
    )
  rescue JSON::ParserError
    raise "OpenRouter returned an outfit plan that was not valid JSON."
  end

  private

  attr_reader :locked_items, :prompt

  def request_body
    {
      model: configured_model,
      temperature: 0.25,
      max_tokens: 1_400,
      response_format: {
        type: "json_schema",
        json_schema: { name: "contextual_outfit_plan", strict: true, schema: response_schema }
      },
      messages: [
        {
          role: "system",
          content: "You are an expert fashion stylist planning an outfit from a finite digital closet. Return only JSON."
        },
        {
          role: "user",
          content: <<~PROMPT
            Plan a complete, cohesive outfit for: #{prompt.to_json}

            Locked closet pieces, which must be used: #{locked_item_context.to_json}

            Define an anchor and flexible garment roles instead of forcing every request into dress or separates.
            Distinguish hard constraints explicitly requested by the user from soft styling preferences.
            Preserve exact shade meaning (for example burgundy is not bright red, cream is not white).
            Do not invent specific owned items. The plan describes roles used for later closet retrieval.
          PROMPT
        }
      ]
    }
  end

  def response_schema
    {
      type: "object",
      additionalProperties: false,
      required: %w[summary anchor garment_roles layering_strategy silhouette_strategy palette_strategy preferred_colors excluded_colors style_terms material_terms pattern_strategy texture_strategy seasons weather occasion formality hard_constraints soft_constraints],
      properties: {
        summary: { type: "string" },
        anchor: {
          type: "object", additionalProperties: false, required: %w[category description],
          properties: { category: { type: "string", enum: CATEGORIES }, description: { type: "string" } }
        },
        garment_roles: {
          type: "array", minItems: 1, maxItems: 6,
          items: {
            type: "object", additionalProperties: false, required: %w[name category required layer description],
            properties: {
              name: { type: "string" }, category: { type: "string", enum: CATEGORIES },
              required: { type: "boolean" }, layer: { type: "integer", minimum: 0, maximum: 5 },
              description: { type: "string" }
            }
          }
        },
        layering_strategy: { type: "string" }, silhouette_strategy: { type: "string" },
        palette_strategy: { type: "string" },
        preferred_colors: { type: "array", maxItems: 6, items: { type: "string" } },
        excluded_colors: { type: "array", maxItems: 6, items: { type: "string" } },
        style_terms: { type: "array", maxItems: 10, items: { type: "string" } },
        material_terms: { type: "array", maxItems: 8, items: { type: "string" } },
        pattern_strategy: { type: "string" }, texture_strategy: { type: "string" },
        seasons: { type: "array", maxItems: 4, items: { type: "string" } },
        weather: { type: "string" }, occasion: { type: "string" },
        formality: { type: "integer", minimum: 1, maximum: 5 },
        hard_constraints: { type: "array", maxItems: 12, items: { type: "string" } },
        soft_constraints: { type: "array", maxItems: 12, items: { type: "string" } }
      }
    }
  end

  def normalize(value)
    roles = Array(value["garment_roles"]).filter_map do |role|
      category = role["category"].to_s.downcase.presence_in(CATEGORIES)
      next unless category

      {
        "name" => role["name"].to_s.squish.presence || category,
        "category" => category,
        "required" => role["required"] != false,
        "layer" => role["layer"].to_i.clamp(0, 5),
        "description" => role["description"].to_s.squish
      }
    end
    roles = fallback_roles if roles.empty?
    anchor_category = value.dig("anchor", "category").to_s.downcase.presence_in(CATEGORIES) || roles.first["category"]
    required = roles.select { |role| role["required"] }.map { |role| role["category"] }
    optional = roles.reject { |role| role["required"] }.map { |role| role["category"] }

    {
      "summary" => value["summary"].to_s.squish,
      "anchor" => { "category" => anchor_category, "description" => value.dig("anchor", "description").to_s.squish },
      "garment_roles" => roles.sort_by { |role| role["layer"] },
      "required_categories" => required,
      "optional_categories" => optional,
      "structure" => required.include?("dress") ? "dress" : (required.include?("swimwear") ? "swimwear" : "separates"),
      "layering_strategy" => value["layering_strategy"].to_s.squish,
      "silhouette_strategy" => value["silhouette_strategy"].to_s.squish,
      "palette_strategy" => value["palette_strategy"].to_s.squish,
      "preferred_colors" => normalized_terms(value["preferred_colors"]),
      "excluded_colors" => normalized_terms(value["excluded_colors"]),
      "style_terms" => normalized_terms(value["style_terms"]),
      "material_terms" => normalized_terms(value["material_terms"]),
      "pattern_strategy" => value["pattern_strategy"].to_s.squish,
      "texture_strategy" => value["texture_strategy"].to_s.squish,
      "seasons" => normalized_terms(value["seasons"]) & %w[spring summer fall winter],
      "weather" => value["weather"].to_s.squish,
      "occasion" => value["occasion"].to_s.squish,
      "formality" => value["formality"].to_i.clamp(1, 5),
      "hard_constraints" => normalized_sentences(value["hard_constraints"]),
      "soft_constraints" => normalized_sentences(value["soft_constraints"])
    }
  end

  def fallback_roles
    [
      { "name" => "top", "category" => "top", "required" => true, "layer" => 1, "description" => "" },
      { "name" => "bottom", "category" => "bottom", "required" => true, "layer" => 1, "description" => "" },
      { "name" => "shoes", "category" => "shoes", "required" => true, "layer" => 2, "description" => "" }
    ]
  end

  def locked_item_context
    locked_items.map { |item| { id: item.id, name: item.name, category: item.category, description: item.style_notes } }
  end

  def normalized_terms(values)
    Array(values).map { |value| value.to_s.downcase.squish }.reject(&:blank?).uniq
  end

  def normalized_sentences(values)
    Array(values).map { |value| value.to_s.squish }.reject(&:blank?).uniq
  end

  def extract_content(response)
    content = response.dig("choices", 0, "message", "content")
    return content if content.is_a?(String)
    return content.filter_map { |part| part["text"] }.join("\n") if content.is_a?(Array)

    raise "OpenRouter did not return an outfit plan."
  end

  def clean_json(content)
    content.to_s.strip.sub(/\A```json\s*/i, "").sub(/\A```\s*/i, "").sub(/\s*```\z/, "")
  end

  def client
    @client ||= OpenrouterClient.new(
      api_key: ENV["OPENROUTER_API_KEY"].presence || raise("OPENROUTER_API_KEY is not configured."),
      base_url: ENV.fetch("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
      read_timeout: 90
    )
  end

  def configured_model
    ENV.fetch("OPENROUTER_OUTFIT_PLANNER_MODEL", ENV.fetch("OPENROUTER_OUTFIT_BRIEF_MODEL", DEFAULT_MODEL))
  end
end
