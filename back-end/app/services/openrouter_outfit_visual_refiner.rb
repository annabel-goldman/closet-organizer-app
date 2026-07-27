require "base64"
require "json"
require "net/http"
require "uri"

class OpenrouterOutfitVisualRefiner
  DEFAULT_BASE_URL = "https://openrouter.ai/api/v1".freeze
  DEFAULT_MODEL = "openai/gpt-4.1-mini".freeze
  MAX_GENERATED_ITEMS = 6
  MAX_CONTEXT_TAGS = 10
  MAX_CONTEXT_STYLE_NOTES = 240
  MAX_CONTEXT_PHOTOS = 8

  def self.call(items:, occasion: nil, reference_photo: nil, reference_profile: nil, preference_context: nil)
    new(
      items: items,
      occasion: occasion,
      reference_photo: reference_photo,
      reference_profile: reference_profile,
      preference_context: preference_context
    ).call
  end

  def initialize(items:, occasion: nil, reference_photo: nil, reference_profile: nil, preference_context: nil)
    @items = Array(items)
    @occasion = occasion.to_s.strip.presence
    @reference_photo = reference_photo
    @reference_profile = reference_profile
    @preference_context = preference_context
  end

  def call
    ensure_configuration!

    parsed = perform_structured_request
    item_ids = normalize_item_ids(parsed.fetch("item_ids", []))
    raise "OpenRouter did not select any valid closet items." if item_ids.empty?
    item_ids = repair_reference_slot_coverage(item_ids)
    validate_complete_outfit_selection!(item_ids)

    {
      name: normalized_text(parsed["name"], fallback: "AI Outfit", max_length: InputLengthPolicy::MAX_OUTFIT_NAME),
      tags: TagListNormalizer.call(parsed["tags"]).first(InputLengthPolicy::MAX_TAGS_PER_RECORD),
      notes: normalized_text(parsed["notes"], fallback: generated_notes_fallback, max_length: InputLengthPolicy::MAX_OUTFIT_NOTES),
      item_ids: item_ids
    }
  end

  private

  attr_reader :items, :occasion, :reference_photo, :reference_profile, :preference_context

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
    raise "OpenRouter returned an unreadable outfit response."
  end

  def request_body
    {
      model: configured_model,
      temperature: 0.35,
      max_tokens: 700,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "generated_outfit",
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
      required: %w[name tags notes item_ids],
      properties: {
        name: { type: "string" },
        tags: {
          type: "array",
          maxItems: 8,
          items: { type: "string" }
        },
        notes: { type: "string" },
        item_ids: {
          type: "array",
          minItems: minimum_generated_items,
          maxItems: MAX_GENERATED_ITEMS,
          items: { type: "integer" }
        }
      }
    }
  end

  def refiner_prompt
    occasion_line = occasion.present? ? "User request: #{occasion}" : "User request: generate a strong outfit from this candidate shortlist."
    photo_line = if items_with_photos.any?
      "Some candidate item photos are included below; other candidates remain eligible through metadata and visual descriptions."
    else
      "No candidate photos are available, so use the metadata and visual descriptions only."
    end
    reference_line = reference_photo.present? ? "A user-uploaded flatlay reference image is included. Use it as the visual target and choose the closest matching closet outfit from the candidates." : nil
    profile_line = reference_profile.present? ? "A structured reference target profile is included. Use it to understand the reference outfit's structure, palette, and signature details, but choose a cohesive closet outfit rather than a rigid item-by-item checklist." : nil
    preference_line = preference_context.present? ? "User feedback history is included. Treat it as gentle guidance about the user's preferred substitutions and recurring visual preferences." : nil

    <<~PROMPT
      Build the final saved outfit from the candidate closet items below.

      #{occasion_line}
      #{photo_line}
      #{reference_line}
      #{profile_line}
      #{preference_line}

      Return a JSON object with:
      - name: a short outfit title
      - tags: 2 to 6 short lowercase tags for the generated look
      - notes: a concise styling note explaining why these pieces work together
      - item_ids: #{minimum_generated_items} to #{MAX_GENERATED_ITEMS} item ids from the provided candidate items

      Rules:
      - Choose the final outfit from these candidates only.
      - Use only ids from the provided candidate items.
      - Build a complete wearable look, not a single hero garment.
      - When a flatlay reference image is provided, recreate the outfit's overall vibe, color palette, silhouette balance, and formality as closely as the candidate closet items allow.
      - When a structured reference target is provided, use required slots such as hoodie, denim shorts, chain bag, or sneakers as strong guidance, but do not include a visually similar item if it makes the final outfit less cohesive.
      - Signature visual anchors may move across item roles when that creates a better recreation: a sequin/embellished top can carry the sparkle of sequined bottoms, a burgundy shoe can echo burgundy boots, and a cream skirt can replace light shorts if it preserves the palette and silhouette better.
      - Prefer a slightly less exact individual item when it better preserves the reference outfit's overall mood, palette, and wearability.
      - When user feedback examples are provided, use them to understand what the user tends to swap toward, such as cream bottoms over blue denim, textured chain bags over plain bags, or burgundy/red shoes over unrelated black boots.
      - When selecting a dress and the candidate set includes shoes, also select one compatible shoe.
      - When selecting tops and the candidate set includes bottoms, also select one compatible bottom unless a dress is selected instead.
      - Prefer adding one bag-like accessory when it complements the request, colors, and formality, but do not force a bag into every outfit.
      - Use item photos when present to judge color, texture, silhouette, proportion, and formality.
      - For candidates without photos, use their metadata and visual descriptions.
      - Avoid overusing one neutral color family unless the user specifically asks for it.
      - It is okay to use text-only items when they are relevant.
      - Do not invent closet item ids or new clothing pieces.
      - Return only JSON and no markdown.
    PROMPT
  end

  def request_content
    content = [
      {
        type: "text",
        text: refiner_prompt
      },
      {
        type: "text",
        text: "Candidate closet items:\n#{items.map { |item| item_context(item) }.join("\n\n")}"
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

    items_with_photos.each do |item|
      content << {
        type: "text",
        text: "Photo for item #{item.id}: #{normalized_context_text(item.name)}"
      }
      content << image_part_for(item.display_photo_attachment)
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
      "- brand: #{normalized_context_text(item.brand, fallback: 'unknown')}",
      "- photo: #{item.display_photo_attachment.attached? ? 'included' : 'not available'}"
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

  def items_with_photos
    @items_with_photos ||= items
      .select { |item| item.display_photo_attachment.attached? }
      .first(MAX_CONTEXT_PHOTOS)
  end

  def validate_complete_outfit_selection!(item_ids)
    selected_items = item_ids.filter_map { |item_id| items_by_id[item_id] }

    if item_ids.length < minimum_generated_items
      raise "OpenRouter selected #{item_ids.length} item(s), but this candidate set requires at least #{minimum_generated_items} for a complete outfit."
    end

    if requires_footwear? && selected_items.none? { |item| shoe_item?(item) }
      raise "OpenRouter did not select footwear even though shoe candidates were available."
    end
  end

  def repair_reference_slot_coverage(item_ids)
    return item_ids if reference_profile.blank?

    OutfitReferenceMatcher
      .new(reference_profile, preference_context: preference_context)
      .repair_selection(item_ids, items, max_items: MAX_GENERATED_ITEMS)
  end

  def minimum_generated_items
    @minimum_generated_items ||= [
      base_garment_count + (requires_footwear? ? 1 : 0),
      MAX_GENERATED_ITEMS
    ].min
  end

  def base_garment_count
    return 2 if top_items.any? && bottom_items.any? && dress_items.empty?

    1
  end

  def requires_footwear?
    shoe_items.any? && garment_items.any?
  end

  def items_by_id
    @items_by_id ||= items.index_by(&:id)
  end

  def garment_items
    @garment_items ||= items.reject { |item| shoe_item?(item) || bag_item?(item) || accessory_item?(item) }
  end

  def dress_items
    @dress_items ||= items.select { |item| item.category.to_s == "dress" }
  end

  def top_items
    @top_items ||= items.select { |item| item.category.to_s == "top" }
  end

  def bottom_items
    @bottom_items ||= items.select { |item| item.category.to_s == "bottom" }
  end

  def shoe_items
    @shoe_items ||= items.select { |item| shoe_item?(item) }
  end

  def shoe_item?(item)
    item.category.to_s == "shoes" || item_text(item).match?(/\b(shoe|shoes|sneaker|sneakers|boot|boots|heel|heels|sandal|sandals|flat|flats|pump|pumps|mule|mules)\b/i)
  end

  def bag_item?(item)
    item_text(item).match?(/\b(bag|handbag|purse|tote|crossbody|clutch|hobo)\b/i)
  end

  def accessory_item?(item)
    item.category.to_s == "accessory"
  end

  def item_text(item)
    ([ item.name, item.category, item.brand ] + TagListNormalizer.call(item.tags)).join(" ")
  end

  def image_part_for(photo)
    {
      type: "image_url",
      image_url: {
        url: photo_data_url(photo)
      }
    }
  end

  def photo_data_url(photo)
    photo.blob.open do |file|
      encoded = Base64.strict_encode64(File.binread(file.path))
      return "data:#{photo.blob.content_type.presence || 'image/png'};base64,#{encoded}"
    end
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
      .first(MAX_GENERATED_ITEMS)
  end

  def normalize_item_id(value)
    Integer(value)
  rescue ArgumentError, TypeError
    nil
  end

  def normalized_text(value, fallback:, max_length:)
    text = value.to_s.squish
    text = fallback if text.blank?
    text.truncate(max_length, omission: "...")
  end

  def generated_notes_fallback
    return "Generated from the uploaded flatlay reference and closet item context." if reference_photo.present?

    occasion.present? ? "Generated for #{occasion}." : "Generated from closet item photos, metadata, and visual descriptions."
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
