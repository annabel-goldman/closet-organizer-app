require "base64"
require "json"
require "net/http"
require "uri"

class OpenrouterMetadataSuggester
  DEFAULT_BASE_URL = "https://openrouter.ai/api/v1".freeze
  DEFAULT_MODEL = "openai/gpt-4.1-mini".freeze

  def self.call(source_photo, category_hint: nil, reference_photos: [], metadata_context: {})
    new(
      source_photo,
      category_hint: category_hint,
      reference_photos: reference_photos,
      metadata_context: metadata_context
    ).call
  end

  def initialize(source_photo, category_hint: nil, reference_photos: [], metadata_context: {})
    @source_photo = source_photo
    @category_hint = category_hint
    @reference_photos = Array(reference_photos).compact
    @metadata_context = metadata_context
  end

  def call
    ensure_configuration!

    parsed = perform_structured_request

    {
      category: normalize_category(parsed.fetch("category", "")) || normalize_category(category_hint) || "",
      name: parsed.fetch("name", "").to_s.strip,
      brand: parsed.fetch("brand", "").to_s.strip,
      tags: TagListNormalizer.call(parsed.fetch("tags", [])),
      provider: "openrouter",
      vision_model: configured_model
    }
  end

  private

  attr_reader :category_hint, :metadata_context, :reference_photos, :source_photo

  def perform_structured_request
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
    request.body = request_body.to_json

    response = http.request(request)
    parsed = JSON.parse(response.body)

    return parse_json_payload(extract_message_content(parsed)) if response.is_a?(Net::HTTPSuccess)

    error_message = parsed.dig("error", "message") || "OpenRouter request failed with status #{response.code}"
    raise error_message
  rescue JSON::ParserError
    raise "OpenRouter returned an unreadable metadata response."
  end

  def request_body
    {
      model: configured_model,
      temperature: 0.1,
      max_tokens: 500,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "clothing_item_metadata",
          strict: true,
          schema: response_schema
        }
      },
      messages: [
        {
          role: "system",
          content: "You are a fashion cataloging assistant. Return only valid JSON."
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
      required: %w[category name brand tags],
      properties: {
        category: { type: "string" },
        name: { type: "string" },
        brand: { type: "string" },
        tags: {
          type: "array",
          maxItems: 8,
          items: { type: "string" }
        }
      }
    }
  end

  def suggestion_prompt
    category_line = category_hint.present? ? "- Category hint: #{category_hint}" : nil
    metadata_lines = metadata_prompt_lines

    <<~PROMPT
      Analyze this clothing image and suggest metadata for saving it in a digital closet.

      Return a JSON object with:
      - category: a short normalized clothing type like sweater, shirt, jacket, jeans, dress, skirt, shoes, or bag
      - name: a concise, natural product-style name for the item
      - brand: the likely brand only if it is visible or strongly implied; otherwise return an empty string
      - tags: 3 to 8 short lowercase tags that help with search and filtering

      Rules:
      - Focus on the main clothing item shown in the image.
      - The first image is the latest item-focused photo. Any additional images are original/reference context for the same item.
      - Keep category short, lowercase, and normalized to the main item type.
      - Keep the name short and useful, such as "White Button-Up Shirt" or "Black Wide-Leg Trousers".
      - Do not include the brand inside the name unless it is part of the visible product identity.
      - Tags should be lowercase and should not repeat the exact full name.
      - Prefer tags for color, silhouette, material, pattern, vibe, and category.
      - If the brand is unclear, return an empty string for brand.
      - Treat any provided current metadata context as user-maintained context for this same item, especially when reconciling multiple images.
      - Return only JSON and no markdown.
      #{category_line}
      #{metadata_lines.present? ? "\nCurrent metadata context:\n#{metadata_lines.join("\n")}" : ""}
    PROMPT
  end

  def request_content
    content = [
      {
        type: "text",
        text: suggestion_prompt
      },
      {
        type: "text",
        text: "Latest item-focused photo:"
      },
      image_part_for(source_photo)
    ]

    reference_photos.each_with_index do |photo, index|
      content << {
        type: "text",
        text: index.zero? ? "Original/reference source image:" : "Additional reference image:"
      }
      content << image_part_for(photo)
    end

    content
  end

  def extract_message_content(response)
    content = response.dig("choices", 0, "message", "content")

    case content
    when String
      content
    when Array
      content.filter_map { |part| part["text"] }.join("\n")
    else
      raise "OpenRouter did not return metadata content."
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

  def with_source_file(photo)
    if photo.respond_to?(:blob)
      photo.blob.open do |file|
        yield file.path, photo.blob.content_type.presence || "image/png"
      end
    elsif photo.respond_to?(:tempfile) && photo.tempfile.present?
      yield photo.tempfile.path, photo.content_type.presence || "image/png"
    else
      content_type = photo.respond_to?(:content_type) ? photo.content_type.presence : nil
      yield photo.path, content_type || "image/png"
    end
  end

  def source_photo_data_url(photo)
    with_source_file(photo) do |file_path, content_type|
      encoded = Base64.strict_encode64(File.binread(file_path))
      return "data:#{content_type};base64,#{encoded}"
    end
  end

  def image_part_for(photo)
    {
      type: "image_url",
      image_url: {
        url: source_photo_data_url(photo)
      }
    }
  end

  def metadata_prompt_lines
    return [] if metadata_context.blank?

    lines = []
    lines << "- Category: #{metadata_context[:category]}" if metadata_context[:category].present?
    lines << "- Name: #{metadata_context[:name]}" if metadata_context[:name].present?
    lines << "- Brand: #{metadata_context[:brand]}" if metadata_context[:brand].present?
    lines << "- Size: #{metadata_context[:size]}" if metadata_context[:size].present?
    lines << "- Date: #{metadata_context[:date]}" if metadata_context[:date].present?
    if metadata_context[:tags].present?
      lines << "- Tags: #{Array(metadata_context[:tags]).join(', ')}"
    end
    lines
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
    ENV.fetch("OPENROUTER_METADATA_MODEL", ENV.fetch("OPENROUTER_MODEL", DEFAULT_MODEL))
  end

  def normalize_category(value)
    value.to_s.strip.downcase.presence
  end
end
