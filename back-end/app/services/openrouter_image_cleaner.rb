require "base64"
require "image_processing/mini_magick"
require "json"
require "net/http"
require "tempfile"
require "uri"

class OpenrouterImageCleaner
  DEFAULT_BASE_URL = "https://openrouter.ai/api/v1".freeze
  DEFAULT_MODEL = "google/gemini-2.5-flash-image".freeze
  DEFAULT_MODELED_OUTFIT_MODEL = "bytedance-seed/seedream-4.5".freeze
  DEFAULT_MODELED_OUTFIT_RESOLUTION = "2K".freeze
  MAX_MODELED_OUTFIT_REFERENCES = 14

  def self.modeled_outfit_model
    ENV.fetch("OPENROUTER_MODELED_OUTFIT_MODEL", DEFAULT_MODELED_OUTFIT_MODEL)
  end

  def self.call(source_photo, prompt_context: {}, reference_photos: [], metadata_context: {}, mode: :catalog, model: nil)
    new(
      source_photo,
      prompt_context: prompt_context,
      reference_photos: reference_photos,
      metadata_context: metadata_context,
      mode: mode,
      model: model
    ).call
  end

  def initialize(source_photo, prompt_context: {}, reference_photos: [], metadata_context: {}, mode: :catalog, model: nil)
    @source_photo = source_photo
    @prompt_context = prompt_context
    @reference_photos = Array(reference_photos).compact
    @metadata_context = metadata_context
    @mode = mode.to_sym
    @model_override = model
  end

  def call
    ensure_configuration!

    raw_image_tempfile = nil
    png_tempfile = nil

    with_source_file do |file_path, filename_root, content_type|
      primary_data_url = source_photo_data_url(file_path, content_type)
      if mode == :modeled_outfit
        response = perform_image_request(
          model: configured_model,
          prompt: generation_prompt,
          input_data_urls: modeled_outfit_input_data_urls(primary_data_url)
        )
        generated_image_data_url = extract_image_api_data_url(response)
      else
        response = perform_request(
          model: configured_model,
          prompt: generation_prompt,
          data_url: primary_data_url
        )
        generated_image_data_url = extract_generated_image_data_url(response)
      end

      raw_image_tempfile = tempfile_from_data_url(generated_image_data_url, filename_root)
      png_tempfile = ImageProcessing::MiniMagick.source(raw_image_tempfile.path).convert("png").call

      {
        tempfile: png_tempfile,
        filename: "#{filename_root}-clean.png",
        content_type: "image/png",
        provider: "openrouter",
        model: configured_model,
        provider_api: mode == :modeled_outfit ? "images" : "chat_completions",
        aspect_ratio: modeled_preview? ? "4:5" : nil,
        resolution: mode == :modeled_outfit ? modeled_outfit_resolution : nil,
        usage: response["usage"],
        raw_response: response
      }
    end
  ensure
    raw_image_tempfile&.close!
  end

  private

  attr_reader :metadata_context, :mode, :model_override, :prompt_context, :reference_photos, :source_photo

  def perform_request(model:, prompt:, data_url:)
    perform_json_request(
      path: "/chat/completions",
      body: request_body(model: model, prompt: prompt, data_url: data_url)
    )
  end

  def perform_image_request(model:, prompt:, input_data_urls:)
    perform_json_request(
      path: "/images",
      body: image_request_body(model: model, prompt: prompt, input_data_urls: input_data_urls)
    )
  end

  def perform_json_request(path:, body:)
    uri = URI.parse("#{base_url}#{path}")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = (uri.scheme == "https")
    http.read_timeout = 120
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
    raise "OpenRouter returned an unreadable image response."
  end

  def request_body(model:, prompt:, data_url:)
    body = {
      model: model,
      stream: false,
      modalities: %w[image text],
      messages: [
        {
          role: "system",
          content: system_prompt
        },
        {
          role: "user",
          content: request_content(prompt: prompt, data_url: data_url)
        }
      ]
    }

    body[:image_config] = { aspect_ratio: "4:5" } if modeled_preview?
    body
  end

  def image_request_body(model:, prompt:, input_data_urls:)
    {
      model: model,
      prompt: prompt,
      n: 1,
      resolution: modeled_outfit_resolution,
      aspect_ratio: "4:5",
      output_format: "png",
      input_references: input_data_urls.map do |data_url|
        {
          type: "image_url",
          image_url: { url: data_url }
        }
      end
    }
  end

  def generation_prompt
    return modeled_generation_prompt if mode == :modeled
    return modeled_outfit_generation_prompt if mode == :modeled_outfit

    details = []
    details << "Item name: #{prompt_context[:name]}" if prompt_context[:name].present?
    details << "Category: #{prompt_context[:category]}" if prompt_context[:category].present?
    details << "Dominant color: #{prompt_context[:color]}" if prompt_context[:color].present?
    details << "Material cue: #{prompt_context[:material]}" if prompt_context[:material].present?
    details << "Style cue: #{prompt_context[:style]}" if prompt_context[:style].present?
    details << "Original detection notes: #{prompt_context[:notes]}" if prompt_context[:notes].present?

    hard_constraints = Array(prompt_context[:hard_constraints]).compact_blank
    soft_hints = Array(prompt_context[:soft_hints]).compact_blank
    appearance_summary = prompt_context[:appearance_summary].presence
    metadata_lines = metadata_prompt_lines
    presentation_constraints = presentation_prompt_constraints

    <<~PROMPT
      Create a single realistic catalog-style PNG of the same clothing item shown in the reference image.

      Requirements:
      - Preserve the exact garment identity, including category, silhouette, fit, color, graphics, logos, trim, neckline, sleeve length, and material cues.
      - The output may look like a newly photographed studio product image, but it must still clearly be the same item.
      - Show only one item centered in frame.
      - Use a clean plain white studio background.
      - Remove people, body parts, hangers, background clutter, extra garments, props, and shadows that distract from the item.
      - For jewelry, watches, sunglasses, boxed accessories, or luxury goods, preserve any visible branded box, tray, pouch, case, packaging, or display holder when it is part of the product presentation.
      - Do not treat a jewelry box, branded case, display tray, or storage pouch as removable clutter unless it clearly obscures the item.
      - Keep the style photorealistic and suitable for an ecommerce product card.
      - Do not invent a different garment or change the dominant color/pattern.
      - Treat the structured fields and description below as identity constraints from an earlier identification pass.
      - The first image is the latest item-focused photo. Any additional images are original/reference context for the same item.
      - If the image and the text disagree, preserve the same garment identity as faithfully as possible instead of inventing a new item.

      #{details.join("\n")}
      #{metadata_lines.present? ? "\nCurrent metadata context:\n#{metadata_lines.join("\n")}" : ""}
      #{appearance_summary.present? ? "\nAppearance summary:\n#{appearance_summary}" : ""}
      #{hard_constraints.present? ? "\nHard constraints:\n#{hard_constraints.map { |constraint| "- #{constraint}" }.join("\n")}" : ""}
      #{presentation_constraints.present? ? "\nProduct presentation constraints:\n#{presentation_constraints.map { |constraint| "- #{constraint}" }.join("\n")}" : ""}
      #{soft_hints.present? ? "\nSoft hints:\n#{soft_hints.map { |hint| "- #{hint}" }.join("\n")}" : ""}
    PROMPT
  end

  def modeled_generation_prompt
    details = []
    details << "Item name: #{prompt_context[:name]}" if prompt_context[:name].present?
    details << "Category: #{prompt_context[:category]}" if prompt_context[:category].present?
    details << "Style cue: #{prompt_context[:style]}" if prompt_context[:style].present?

    <<~PROMPT
      Create one photorealistic cutout-style wardrobe preview using the clothing item in the first image and the person's private reference photos that follow it.

      Requirements:
      - Generate a vertical 4:5 portrait image, never landscape or square.
      - Use a vertical composition that keeps the referenced item fully visible with comfortable white space around the person.
      - Preserve the exact clothing item identity, color, silhouette, fit, graphics, logos, trim, neckline, sleeve length, and material cues.
      - Use the person's face, hair, skin tone, body proportions, and general identity only from the private reference photos.
      - Reconcile the person's consistent features across all private references; use the first private reference as the primary identity anchor if details conflict.
      - Isolate only the person wearing the item, centered against a solid pure white (#FFFFFF) background like a clean full-body cutout.
      - Keep every background pixel uniformly white, including behind the person and beneath the feet. Do not include a room, scenery, furniture, props, texture, gradient, lighting falloff, floor, horizon line, wall-to-floor seam, colored cast, text, or border.
      - Do not add a cast shadow, contact shadow, reflection, halo, glow, or grounding surface. Keep a crisp, clean silhouette boundary so a color-selection magic wand can remove the white background easily.
      - Keep the white background opaque rather than transparent.
      - Do not add extra garments or accessories that are not visible in the clothing-item image.
      - Keep the person and garment photorealistic while presenting them as a clean isolated cutout for a private closet preview.
      - The private reference images are identity context and must not be reproduced as separate people or images in the output.
      - If the item and text disagree, preserve the visible item identity from the first image.

      #{details.join("\n")}
    PROMPT
  end

  def modeled_outfit_generation_prompt
    pieces = Array(prompt_context[:items]).each_with_index.map do |item, index|
      details = [ "#{index + 1}. #{item[:name] || item['name']}" ]
      category = item[:category] || item["category"]
      style = item[:style] || item["style"]
      tags = item[:tags] || item["tags"]
      details << "category: #{category}" if category.present?
      details << "style: #{style}" if style.present?
      details << "tags: #{Array(tags).join(', ')}" if Array(tags).compact_blank.present?
      details.join("; ")
    end
    private_reference_count = reference_photo_entries.count do |entry|
      entry[:label].to_s.start_with?("Private model reference photo")
    end
    has_flatlay_composition_reference = reference_photo_entries.any? do |entry|
      entry[:label].to_s.start_with?("Styled flat-lay composition reference")
    end
    flatlay_reference_guidance = if has_flatlay_composition_reference
      <<~GUIDANCE.chomp
        - The final input reference image is the user's styled flat-lay composition. Use it as the authority for intentional styling relationships: layering order, which pieces sit over or under others, open or closed outerwear, folded or rolled details, accessory pairing, and the overall visual balance of the look.
        - Translate those flat-lay styling choices into a natural, physically wearable outfit on the person. Do not copy the flat-lay's literal two-dimensional positions or distort garments to match the collage geometry.
        - The individual garment references remain the authority for each item's identity and details; the flat lay is composition guidance and must not introduce a new garment.
      GUIDANCE
    end

    <<~PROMPT
      Create one photorealistic cutout-style outfit preview of the person wearing the complete outfit represented by the garment reference images.

      Requirements:
      - Generate a vertical 4:5 portrait image, never landscape or square.
      - Frame the person head to toe with the complete outfit visible and comfortable white space above the head and below the feet.
      - The first #{private_reference_count} input reference images are private photos of the same person, ordered from primary identity anchor to additional angles.
      - The next #{pieces.length} input reference images are the outfit pieces, in the same order as the numbered list below.
      #{flatlay_reference_guidance}
      - Use the private model reference photos only for the person's face, hair, skin tone, body proportions, and general identity.
      - Reconcile the person's consistent features across all private references; use the first private reference as the primary identity anchor if details conflict.
      - Preserve every garment shown in the outfit-piece images, including exact colors, silhouettes, fits, graphics, logos, trim, necklines, sleeve lengths, and material cues.
      - Combine the referenced pieces into one coherent, naturally worn full outfit while respecting their categories and the saved outfit order.
      - Isolate only the person wearing the complete look, centered against a solid pure white (#FFFFFF) background like a clean full-body cutout.
      - Keep every background pixel uniformly white, including behind the person and beneath the feet. Do not include a room, scenery, furniture, props, texture, gradient, lighting falloff, floor, horizon line, wall-to-floor seam, colored cast, text, or border.
      - Do not add a cast shadow, contact shadow, reflection, halo, glow, or grounding surface. Keep a crisp, clean silhouette boundary so a color-selection magic wand can remove the white background easily.
      - Keep the white background opaque rather than transparent.
      - Do not add unreferenced clothing, shoes, bags, jewelry, or other accessories.
      - Do not omit a referenced garment unless it is physically impossible to show it because another referenced garment covers it.
      - Keep the person and outfit photorealistic while presenting them as a clean isolated cutout for a private closet preview.
      - The private model reference photos are identity context and must not be reproduced as separate people or images in the output.
      - If the images and text disagree, preserve the visible garment identities from the images.

      Outfit name: #{prompt_context[:name]}#{prompt_context[:notes].present? ? "\nOutfit notes: #{prompt_context[:notes]}" : ""}
      Referenced outfit pieces:
      #{pieces.join("\n")}
    PROMPT
  end

  def system_prompt
    return "You create realistic private wardrobe previews. Return one photorealistic image of the person wearing the reference garment." if mode == :modeled
    return "You create realistic private full-outfit wardrobe previews. Return one photorealistic image of the person wearing the referenced outfit." if mode == :modeled_outfit

    "You create realistic apparel catalog images. Return one clean product photo."
  end

  def modeled_preview?
    %i[modeled modeled_outfit].include?(mode)
  end

  def request_content(prompt:, data_url:)
    content = [
      {
        type: "text",
        text: prompt
      },
      {
        type: "text",
        text: mode == :modeled_outfit ? "Primary outfit piece:" : "Latest item-focused photo:"
      },
      {
        type: "image_url",
        image_url: {
          url: data_url
        }
      }
    ]

    reference_photo_entries.each_with_index do |entry, index|
      fallback_label = if mode == :modeled
        "Private model reference photo:"
      else
        index.zero? ? "Original/reference source image:" : "Additional reference image:"
      end
      content << {
        type: "text",
        text: entry[:label].presence || fallback_label
      }
      content << image_part_for(entry[:photo])
    end

    content
  end

  def extract_generated_image_data_url(response)
    images = response.dig("choices", 0, "message", "images")
    image_data_url = nil

    Array(images).each do |image|
      candidate = image.dig("image_url", "url") || image.dig("imageUrl", "url")
      if candidate.present?
        image_data_url = candidate
        break
      end
    end

    return image_data_url if image_data_url.present?

    raise "OpenRouter did not return a generated image."
  end

  def extract_image_api_data_url(response)
    image = Array(response["data"]).find { |entry| entry["b64_json"].present? }
    raise "OpenRouter did not return a generated image." unless image

    content_type = image["media_type"].presence || "image/png"
    "data:#{content_type};base64,#{image.fetch('b64_json')}"
  end

  def tempfile_from_data_url(data_url, filename_root)
    match = data_url.match(/\Adata:(?<content_type>[-\w.+\/]+);base64,(?<data>.+)\z/m)
    raise "OpenRouter returned an invalid generated image." unless match

    tempfile = Tempfile.new([ "#{filename_root}-cleaned", ".bin" ])
    tempfile.binmode
    tempfile.write(Base64.decode64(match[:data]))
    tempfile.rewind
    tempfile
  end

  def with_source_file
    if source_photo.respond_to?(:blob)
      source_photo.blob.open do |file|
        yield file.path, File.basename(source_photo.blob.filename.to_s, ".*").presence || "item-photo", source_photo.blob.content_type.presence || "image/png"
      end
    elsif source_photo.respond_to?(:tempfile) && source_photo.tempfile.present?
      yield source_photo.tempfile.path, base_filename_from_upload, source_photo.content_type.presence || "image/png"
    else
      yield source_photo.path, base_filename_from_upload, "image/png"
    end
  end

  def base_filename_from_upload
    File.basename(source_photo.original_filename.to_s, ".*").presence || "item-photo"
  end

  def source_photo_data_url(file_path, content_type)
    encoded = Base64.strict_encode64(File.binread(file_path))
    "data:#{content_type};base64,#{encoded}"
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
    with_photo_file(photo) do |file_path, content_type|
      encoded = Base64.strict_encode64(File.binread(file_path))
      return "data:#{content_type};base64,#{encoded}"
    end
  end

  def reference_photo_entries
    Array(reference_photos).filter_map do |entry|
      if entry.is_a?(Hash)
        photo = entry[:photo] || entry["photo"]
        next unless photo

        { photo: photo, label: entry[:label] || entry["label"] }
      else
        { photo: entry, label: nil }
      end
    end
  end

  def modeled_outfit_input_data_urls(primary_outfit_data_url)
    private_references, outfit_references = reference_photo_entries.partition do |entry|
      entry[:label].to_s.start_with?("Private model reference photo")
    end

    private_references.map { |entry| photo_data_url(entry[:photo]) } +
      [ primary_outfit_data_url ] +
      outfit_references.map { |entry| photo_data_url(entry[:photo]) }
  end

  def with_photo_file(photo)
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

  def metadata_prompt_lines
    return [] if metadata_context.blank?

    lines = []
    lines << "- Category: #{metadata_context[:category]}" if metadata_context[:category].present?
    lines << "- Name: #{metadata_context[:name]}" if metadata_context[:name].present?
    lines << "- Brand: #{metadata_context[:brand]}" if metadata_context[:brand].present?
    lines << "- Size: #{metadata_context[:size]}" if metadata_context[:size].present?
    lines << "- Date: #{metadata_context[:date]}" if metadata_context[:date].present?
    lines << "- Visual description: #{metadata_context[:style_notes]}" if metadata_context[:style_notes].present?
    if metadata_context[:tags].present?
      lines << "- Tags: #{Array(metadata_context[:tags]).join(', ')}"
    end
    lines
  end

  def presentation_prompt_constraints
    context_text = [
      prompt_context[:name],
      prompt_context[:category],
      prompt_context[:notes],
      prompt_context[:appearance_summary],
      metadata_context[:category],
      metadata_context[:name],
      metadata_context[:brand],
      metadata_context[:style_notes],
      Array(metadata_context[:tags]).join(" ")
    ].compact_blank.join(" ").downcase

    return [] unless presentation_context?(context_text)

    constraints = [
      "Preserve the visible product presentation exactly when the item is shown in or on a box, case, tray, pouch, packaging, or display holder."
    ]
    if context_text.match?(/\bcartier\b/)
      constraints << "If a Cartier box or Cartier-branded case is visible, keep the item inside that Cartier presentation box/case."
    end
    constraints
  end

  def presentation_context?(context_text)
    accessory_terms = /\b(accessor(?:y|ies)|jewelry|jewellery|earrings?|necklace|bracelet|ring|watch|sunglasses?|glasses|luxury|boxed)\b/
    presentation_terms = /\b(box|case|pouch|tray|holder|packaging|display|cartier)\b/

    context_text.match?(accessory_terms) || context_text.match?(presentation_terms)
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
    return model_override if model_override.present?
    return self.class.modeled_outfit_model if mode == :modeled_outfit

    ENV.fetch("OPENROUTER_IMAGE_CLEAN_MODEL", DEFAULT_MODEL)
  end

  def modeled_outfit_resolution
    ENV.fetch("OPENROUTER_MODELED_OUTFIT_RESOLUTION", DEFAULT_MODELED_OUTFIT_RESOLUTION)
  end
end
