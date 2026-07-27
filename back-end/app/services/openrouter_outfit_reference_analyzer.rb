require "base64"
require "json"
require "net/http"
require "uri"

class OpenrouterOutfitReferenceAnalyzer
  DEFAULT_BASE_URL = "https://openrouter.ai/api/v1".freeze
  DEFAULT_MODEL = "openai/gpt-4.1-mini".freeze
  MAX_TARGET_SLOTS = 8

  def self.call(reference_photo:)
    new(reference_photo: reference_photo).call
  end

  def initialize(reference_photo:)
    @reference_photo = reference_photo
  end

  def call
    ensure_configuration!
    normalize_profile(perform_structured_request)
  end

  private

  attr_reader :reference_photo

  def perform_structured_request
    uri = URI.parse("#{base_url}/chat/completions")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = (uri.scheme == "https")
    http.read_timeout = 45
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
    raise "OpenRouter returned an unreadable outfit reference response."
  end

  def request_body
    {
      model: configured_model,
      temperature: 0.1,
      max_tokens: 850,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "outfit_reference_profile",
          strict: true,
          schema: response_schema
        }
      },
      messages: [
        {
          role: "system",
          content: "You are a visual fashion cataloging assistant. Return only valid JSON."
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
      required: %w[overall_style target_slots],
      properties: {
        overall_style: {
          type: "array",
          maxItems: 8,
          items: { type: "string" }
        },
        target_slots: {
          type: "array",
          minItems: 1,
          maxItems: MAX_TARGET_SLOTS,
          items: {
            type: "object",
            additionalProperties: false,
            required: %w[role required subtype colors materials visual_features weight],
            properties: {
              role: {
                type: "string",
                enum: %w[top bottom dress outerwear shoes bag accessory beauty fragrance unknown]
              },
              required: { type: "boolean" },
              subtype: { type: "string" },
              colors: {
                type: "array",
                maxItems: 5,
                items: { type: "string" }
              },
              materials: {
                type: "array",
                maxItems: 5,
                items: { type: "string" }
              },
              visual_features: {
                type: "array",
                maxItems: 8,
                items: { type: "string" }
              },
              weight: { type: "number" }
            }
          }
        }
      }
    }
  end

  def request_content
    [
      {
        type: "text",
        text: reference_prompt
      },
      {
        type: "text",
        text: "Reference flatlay outfit image:"
      },
      image_part_for_reference_photo
    ]
  end

  def reference_prompt
    <<~PROMPT
      Analyze this uploaded outfit flatlay as a matching target for a user's closet.

      Return a JSON object with:
      - overall_style: short lowercase visual style phrases
      - target_slots: visible outfit item slots to match from the closet

      Rules:
      - Describe visible garments and accessories as objectively as possible.
      - Mark required=true for visually central outfit pieces, including a prominent bag, shoes, or accessory if it defines the look.
      - Use required=false for small cosmetics, perfume, jewelry, or optional extras that should not block a wearable outfit.
      - For each slot, include subtype, colors, materials, and visual_features that would help match closet items.
      - Capture distinctive graphics and motifs such as wings, logos, rhinestones, distressing, chain straps, quilting, embroidery, lace, or metallic hardware.
      - Do not invent brand names.
      - Return only JSON and no markdown.
    PROMPT
  end

  def normalize_profile(raw_profile)
    {
      "overall_style" => TagListNormalizer.call(raw_profile["overall_style"]),
      "target_slots" => Array(raw_profile["target_slots"]).first(MAX_TARGET_SLOTS).map do |slot|
        {
          "role" => slot["role"].to_s,
          "required" => ActiveModel::Type::Boolean.new.cast(slot["required"]),
          "subtype" => slot["subtype"].to_s.squish,
          "colors" => normalized_string_list(slot["colors"]),
          "materials" => normalized_string_list(slot["materials"]),
          "visual_features" => normalized_string_list(slot["visual_features"]),
          "weight" => normalized_weight(slot["weight"])
        }
      end
    }
  end

  def normalized_string_list(value)
    Array(value)
      .map { |entry| entry.to_s.squish.downcase }
      .reject(&:blank?)
      .uniq
  end

  def normalized_weight(value)
    weight = Float(value)
    weight.clamp(0.0, 1.0)
  rescue ArgumentError, TypeError
    0.5
  end

  def extract_message_content(response)
    content = response.dig("choices", 0, "message", "content")

    case content
    when String
      content
    when Array
      content.filter_map { |part| part["text"] }.join("\n")
    else
      raise "OpenRouter did not return outfit reference content."
    end
  end

  def parse_json_payload(content)
    cleaned = content.to_s.strip
    cleaned = cleaned.sub(/\A```json\s*/i, "").sub(/\A```\s*/i, "").sub(/\s*```\z/, "")

    JSON.parse(cleaned)
  rescue JSON::ParserError
    json_start = cleaned.index("{")
    json_end = cleaned.rindex("}")
    raise "OpenRouter returned outfit reference data that was not valid JSON." unless json_start && json_end

    JSON.parse(cleaned[json_start..json_end])
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

  def ensure_configuration!
    raise "OPENROUTER_API_KEY is not configured." if api_key.blank?
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
