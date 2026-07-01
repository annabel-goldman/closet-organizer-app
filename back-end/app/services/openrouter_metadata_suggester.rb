require "base64"
require "json"
require "net/http"
require "uri"

class OpenrouterMetadataSuggester
  DEFAULT_BASE_URL = "https://openrouter.ai/api/v1".freeze
  DEFAULT_MODEL = "openai/gpt-4.1-mini".freeze
  ALLOWED_CATEGORIES = %w[
    top
    bottom
    shoes
    accessory
    dress
    outerwear
    intimates
    swimwear
  ].freeze
  CATEGORY_ALIASES = {
    "accessories" => "accessory",
    "accessory" => "accessory",
    "backpack" => "accessory",
    "blazer" => "outerwear",
    "blouse" => "top",
    "boot" => "shoes",
    "boots" => "shoes",
    "bra" => "intimates",
    "bralette" => "intimates",
    "briefs" => "intimates",
    "camisole" => "top",
    "cami" => "top",
    "cardigan" => "top",
    "coat" => "outerwear",
    "crop top" => "top",
    "flats" => "shoes",
    "bag" => "accessory",
    "handbag" => "accessory",
    "heel" => "shoes",
    "heels" => "shoes",
    "hoodie" => "top",
    "jacket" => "outerwear",
    "jean" => "bottom",
    "jeans" => "bottom",
    "lingerie" => "intimates",
    "pants" => "bottom",
    "purse" => "accessory",
    "scarf" => "accessory",
    "sandal" => "shoes",
    "sandals" => "shoes",
    "shirt" => "top",
    "shorts" => "bottom",
    "skirt" => "bottom",
    "sneaker" => "shoes",
    "sneakers" => "shoes",
    "sweater" => "top",
    "sweatpants" => "bottom",
    "swim" => "swimwear",
    "swim top" => "swimwear",
    "swim trunks" => "swimwear",
    "swimsuit" => "swimwear",
    "swimwear" => "swimwear",
    "bathing suit" => "swimwear",
    "bikini" => "swimwear",
    "one-piece" => "swimwear",
    "two-piece" => "swimwear",
    "tank" => "top",
    "tank top" => "top",
    "tee" => "top",
    "t-shirt" => "top",
    "trousers" => "bottom",
    "underwear" => "intimates"
  }.freeze
  COLOR_WORDS = %w[
    aqua
    beige
    black
    blue
    bronze
    brown
    burgundy
    camel
    charcoal
    copper
    coral
    cream
    denim
    gold
    gray
    green
    grey
    ivory
    khaki
    lavender
    maroon
    metallic
    mint
    navy
    nude
    olive
    orange
    pink
    purple
    red
    rose
    rust
    silver
    tan
    taupe
    teal
    turquoise
    violet
    white
    wine
    yellow
  ].freeze
  LOWERCASE_NAME_WORDS = %w[
    a
    an
    and
    as
    at
    but
    by
    for
    from
    in
    into
    nor
    of
    on
    onto
    or
    over
    per
    the
    to
    with
  ].freeze

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
      name: normalized_name(parsed.fetch("name", "")),
      brand: parsed.fetch("brand", "").to_s.strip,
      style_notes: normalized_style_notes(parsed.fetch("style_notes", "")),
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
      required: %w[category name brand style_notes tags],
      properties: {
        category: { type: "string", enum: ALLOWED_CATEGORIES },
        name: { type: "string" },
        brand: { type: "string" },
        style_notes: { type: "string" },
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
      - category: exactly one of #{ALLOWED_CATEGORIES.join(', ')}
      - name: a concise, natural product-style name for the item
      - brand: the likely brand only if it is visible or strongly implied; otherwise return an empty string
      - style_notes: one concise objective visual description of the item itself; describe color, material, silhouette, length, pattern, graphics, hardware, closures, straps, texture, and distinctive visible details when present
      - tags: 3 to 8 short lowercase tags that help with search and filtering

      Rules:
      - Focus on the main clothing item shown in the image.
      - The first image is the latest item-focused photo. Any additional images are original/reference context for the same item.
      - Use the broad category field only for the allowed closet types.
      - Put more specific item types like blouse, sweater, skirt, jeans, boots, bra, bag, or camisole in tags instead of category.
      - Keep the name short and useful, such as "White Button-Up Shirt" or "Black Wide-Leg Trousers".
      - Use title case for names, keeping short connector words like "and", "of", "the", and "with" lowercase unless they start the name.
      - The name must start with the dominant color or color family for alphabetical sorting. Put intensity words after the color, such as "Red Bright Sweater" instead of "Bright Red Sweater".
      - Do not include the brand inside the name unless it is part of the visible product identity.
      - Tags should be lowercase and should not repeat the exact full name.
      - Prefer tags for color, silhouette, material, pattern, vibe, and category.
      - The visual description should be observational and item-focused, not outfit advice. Do not say how to style, pair, layer, or wear the item.
      - Include specific visual signals that would help match this item to a reference flatlay, such as denim wash, distressing, sleeve shape, graphic motifs, chain straps, quilting, rhinestones, or metallic hardware.
      - Keep the visual description under #{InputLengthPolicy::MAX_CLOTHING_ITEM_STYLE_NOTES} characters.
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
    lines << "- Current visual description: #{metadata_context[:style_notes]}" if metadata_context[:style_notes].present?
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
    normalized = value.to_s.strip.downcase.squish
    return nil if normalized.blank?
    return normalized if ALLOWED_CATEGORIES.include?(normalized)

    CATEGORY_ALIASES[normalized]
  end

  def normalized_name(value)
    name = value.to_s.squish
    return "" if name.blank?

    words = name.split(" ")
    color_index = words.index { |word| color_word?(word) }
    if color_index.present? && color_index.positive?
      color_word = words.delete_at(color_index)
      words = [ color_word ] + words
    end

    title_case_name_words(words).join(" ")
  end

  def normalized_style_notes(value)
    value.to_s.squish.truncate(InputLengthPolicy::MAX_CLOTHING_ITEM_STYLE_NOTES, omission: "...")
  end

  def color_word?(word)
    COLOR_WORDS.include?(word.to_s.downcase.gsub(/\A[^a-z]+|[^a-z]+\z/, ""))
  end

  def title_case_name_words(words)
    words.map.with_index do |word, index|
      normalized_word = word.to_s.downcase
      next normalized_word if index.positive? && LOWERCASE_NAME_WORDS.include?(normalized_word)

      title_case_name_word(normalized_word)
    end
  end

  def title_case_name_word(word)
    word.split("-").map { |part| part.sub(/\A\p{Ll}/) { |letter| letter.upcase } }.join("-")
  end
end
