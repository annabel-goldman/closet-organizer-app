require "base64"
require "json"
require "net/http"
require "uri"

class OpenrouterVisionService
  DEFAULT_BASE_URL = "https://openrouter.ai/api/v1".freeze

  def initialize(outfit_upload)
    @outfit_upload = outfit_upload
    @last_raw_response = nil
  end

  private

  attr_reader :last_raw_response, :outfit_upload

  def perform_structured_request(model:, prompt:, schema_name:, schema:)
    ensure_configuration!

    body = request_body(model: model, prompt: prompt, schema_name: schema_name, schema: schema)
    response = perform_request(body)
    @last_raw_response = response
    content = extract_message_content(response)
    parse_json_payload(content)
  end

  def request_body(model:, prompt:, schema_name:, schema:)
    {
      model: model,
      temperature: 0.1,
      max_tokens: 900,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: schema_name,
          strict: true,
          schema: schema
        }
      },
      messages: [
        {
          role: "system",
          content: "You are a fashion cataloging assistant. Return only valid JSON."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image_url",
              image_url: {
                url: source_photo_data_url
              }
            }
          ]
        }
      ]
    }
  end

  def perform_request(body)
    OpenrouterClient.new(
      api_key: api_key,
      base_url: base_url,
      read_timeout: 60
    ).post_json(path: "chat/completions", body: body)
  end

  def extract_message_content(response)
    content = response.dig("choices", 0, "message", "content")

    case content
    when String
      content
    when Array
      content.filter_map { |part| part["text"] }.join("\n")
    else
      raise "OpenRouter did not return detection content."
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

  def unit_interval_schema
    {
      type: "number",
      minimum: 0,
      maximum: 1
    }
  end

  def box_schema
    {
      type: "object",
      additionalProperties: false,
      required: %w[x y width height],
      properties: {
        x: unit_interval_schema,
        y: unit_interval_schema,
        width: unit_interval_schema,
        height: unit_interval_schema
      }
    }
  end

  def normalize_unit_interval(value)
    number = Float(value)
    return nil unless number.finite?

    [ [ number, 0.0 ].max, 1.0 ].min
  rescue ArgumentError, TypeError
    nil
  end

  def normalize_box(value)
    return nil unless value.is_a?(Hash)

    x = normalize_unit_interval(value["x"] || value[:x])
    y = normalize_unit_interval(value["y"] || value[:y])
    width = normalize_unit_interval(value["width"] || value[:width])
    height = normalize_unit_interval(value["height"] || value[:height])
    return nil if [ x, y, width, height ].any?(&:nil?)

    width = [ width, 1.0 - x ].min
    height = [ height, 1.0 - y ].min
    return nil if width <= 0.01 || height <= 0.01

    {
      x: x,
      y: y,
      width: width,
      height: height
    }
  end

  def source_photo_data_url
    content_type = outfit_upload.source_photo.blob.content_type.presence || "image/jpeg"
    encoded = Base64.strict_encode64(outfit_upload.source_photo.download)
    "data:#{content_type};base64,#{encoded}"
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
end
