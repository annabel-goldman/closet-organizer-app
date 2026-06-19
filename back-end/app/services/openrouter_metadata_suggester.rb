require "base64"
require "json"
require "net/http"
require "uri"

class OpenrouterMetadataSuggester
  DEFAULT_BASE_URL = "https://openrouter.ai/api/v1".freeze
  DEFAULT_MODEL = "openai/gpt-4.1-mini".freeze
  DEFAULT_MAX_TOKENS = 300
  SMALL_TITLE_WORDS = %w[a an and as at but by en for if in nor of on or per the to via vs with].freeze
  BASE_COLOR_WORDS = %w[
    black white gray grey red blue green yellow orange purple pink brown beige tan cream ivory
    navy teal turquoise gold silver burgundy maroon olive lilac lavender peach rust coral khaki charcoal
  ].freeze
  MODIFIED_COLOR_PATTERN = /
    \b
    (?:
      light|dark|bright|pale|deep|soft|muted|dusty|neon|pastel|rich|faded
    )
    \s+
    (?:
      #{BASE_COLOR_WORDS.join("|")}
    )
    \b
  /ix.freeze
  NAMED_COLOR_PATTERN = /
    \b
    (?:
      black\s+and\s+white|
      off[-\s]white|
      navy\s+blue|
      sky\s+blue|
      baby\s+blue|
      powder\s+blue|
      forest\s+green|
      olive\s+green|
      hot\s+pink|
      rose\s+gold|
      #{BASE_COLOR_WORDS.join("|")}
    )
    \b
  /ix.freeze

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
      name: normalize_item_name(parsed.fetch("name", ""), tags: parsed.fetch("tags", [])),
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
      max_tokens: configured_max_tokens,
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
      - If a visible color is identifiable, include it first in the name.
      - Use title capitalization for the name. Capitalize major words, but keep small joining words like "with", "and", or "of" lowercase unless they start the name.
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

  def configured_max_tokens
    integer_env("OPENROUTER_METADATA_MAX_TOKENS", DEFAULT_MAX_TOKENS)
  end

  def integer_env(name, default)
    Integer(ENV.fetch(name, default))
  rescue ArgumentError, TypeError
    default
  end

  def normalize_category(value)
    value.to_s.strip.downcase.presence
  end

  def normalize_item_name(value, tags: [])
    raw_name = value.to_s.strip.gsub(/\s+/, " ")
    return "" if raw_name.blank?

    color_phrase = extract_color_phrase(raw_name) || extract_color_phrase_from_tags(tags)
    reordered_name = move_or_prefix_color_phrase(raw_name, color_phrase)

    titleize_item_name(reordered_name)
  end

  def extract_color_phrase_from_tags(tags)
    Array(tags)
      .filter_map { |tag| extract_color_phrase(tag.to_s) }
      .find(&:present?)
  end

  def extract_color_phrase(text)
    normalized = text.to_s.strip.gsub(/\s+/, " ")
    return nil if normalized.blank?

    lower = normalized.downcase
    match = MODIFIED_COLOR_PATTERN.match(lower) || NAMED_COLOR_PATTERN.match(lower)
    return nil unless match

    normalized[match.begin(0)...match.end(0)]
  end

  def move_or_prefix_color_phrase(name, color_phrase)
    normalized_name = name.to_s.strip.gsub(/\s+/, " ")
    normalized_color = color_phrase.to_s.strip.gsub(/\s+/, " ")
    return normalized_name if normalized_name.blank? || normalized_color.blank?

    lower_name = normalized_name.downcase
    lower_color = normalized_color.downcase
    return normalized_name if lower_name == lower_color || lower_name.start_with?("#{lower_color} ")

    match = /#{Regexp.escape(lower_color)}/i.match(normalized_name)
    if match
      before = normalized_name[0...match.begin(0)].strip
      after = normalized_name[match.end(0)..].to_s.strip
      remainder = [before, after].reject(&:blank?).join(" ")
      return remainder.blank? ? normalized_name : "#{normalized_color} #{remainder}"
    end

    "#{normalized_color} #{normalized_name}"
  end

  def titleize_item_name(value)
    words = value.to_s.strip.gsub(/\s+/, " ").split(" ")

    words.map.with_index do |word, index|
      titleize_name_token(word, first: index.zero?, last: index == words.length - 1)
    end.join(" ")
  end

  def titleize_name_token(token, first:, last:)
    token.split("-").map.with_index do |segment, segment_index|
      titleize_name_segment(
        segment,
        first: first && segment_index.zero?,
        last: last && segment_index == token.split("-").length - 1
      )
    end.join("-")
  end

  def titleize_name_segment(segment, first:, last:)
    return segment if segment.blank?

    lower = segment.downcase
    return lower if !first && !last && SMALL_TITLE_WORDS.include?(lower) && segment == lower

    lower.gsub(/\A[[:alpha:]]/) { |character| character.upcase }
  end
end
