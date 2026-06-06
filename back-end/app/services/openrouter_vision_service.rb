require "base64"
require "json"
require "net/http"
require "uri"

class OpenrouterVisionService
  DEFAULT_BASE_URL = "https://openrouter.ai/api/v1".freeze
  DEFAULT_MAX_TOKENS = 900
  MAX_RETRY_TOKENS = 1800

  def initialize(outfit_upload)
    @outfit_upload = outfit_upload
    @last_raw_response = nil
  end

  private

  attr_reader :last_raw_response, :outfit_upload

  def perform_structured_request(model:, prompt:, schema_name:, schema:)
    ensure_configuration!

    max_tokens = configured_max_tokens

    loop do
      body = request_body(
        model: model,
        prompt: prompt,
        schema_name: schema_name,
        schema: schema,
        max_tokens: max_tokens
      )
      response = perform_request(body)
      @last_raw_response = response
      content = extract_message_content(response)

      return parse_json_payload(content)
    rescue JSON::ParserError, RuntimeError => error
      raise unless retryable_json_parse_error?(error)

      retry_tokens = retry_max_tokens(max_tokens)
      raise if retry_tokens == max_tokens

      max_tokens = retry_tokens
    end
  end

  def request_body(model:, prompt:, schema_name:, schema:, max_tokens: configured_max_tokens)
    {
      model: model,
      temperature: 0.1,
      max_tokens: max_tokens,
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
    uri = URI.parse("#{base_url}/chat/completions")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = (uri.scheme == "https")
    http.read_timeout = 60
    http.open_timeout = 10

    request = Net::HTTP::Post.new(uri)
    request["Authorization"] = "Bearer #{api_key}"
    request["Content-Type"] = "application/json"
    request["HTTP-Referer"] = ENV["OPENROUTER_SITE_URL"] if ENV["OPENROUTER_SITE_URL"].present?
    request["X-Title"] = ENV["OPENROUTER_APP_NAME"] if ENV["OPENROUTER_APP_NAME"].present?
    request.body = body.to_json

    response = http.request(request)
    parsed = JSON.parse(response.body)

    return parsed if response.is_a?(Net::HTTPSuccess)

    error_message = parsed.dig("error", "message") || "OpenRouter request failed with status #{response.code}"
    raise error_message
  rescue JSON::ParserError
    raise "OpenRouter returned an unreadable response."
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

  def configured_max_tokens
    integer_env("OPENROUTER_VISION_MAX_TOKENS", DEFAULT_MAX_TOKENS)
  end

  def retry_max_tokens(current_max_tokens)
    next_max_tokens = [ current_max_tokens * 2, MAX_RETRY_TOKENS ].min
    [ next_max_tokens, current_max_tokens ].max
  end

  def retryable_json_parse_error?(error)
    error.is_a?(JSON::ParserError) || error.message == "OpenRouter returned data that was not valid JSON."
  end

  def integer_env(name, default)
    Integer(ENV.fetch(name, default))
  rescue ArgumentError, TypeError
    default
  end
end
