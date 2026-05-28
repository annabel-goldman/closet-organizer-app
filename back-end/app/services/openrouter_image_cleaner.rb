require "base64"
require "image_processing/mini_magick"
require "json"
require "net/http"
require "tempfile"
require "uri"

class OpenrouterImageCleaner
  DEFAULT_BASE_URL = "https://openrouter.ai/api/v1".freeze
  DEFAULT_MODEL = "google/gemini-2.5-flash-image".freeze

  def self.call(source_photo, prompt_context: {}, reference_photos: [], metadata_context: {})
    new(
      source_photo,
      prompt_context: prompt_context,
      reference_photos: reference_photos,
      metadata_context: metadata_context
    ).call
  end

  def initialize(source_photo, prompt_context: {}, reference_photos: [], metadata_context: {})
    @source_photo = source_photo
    @prompt_context = prompt_context
    @reference_photos = Array(reference_photos).compact
    @metadata_context = metadata_context
  end

  def call
    ensure_configuration!

    raw_image_tempfile = nil
    png_tempfile = nil

    with_source_file do |file_path, filename_root, content_type|
      response = perform_request(
        model: configured_model,
        prompt: generation_prompt,
        data_url: source_photo_data_url(file_path, content_type)
      )
      raw_image_tempfile = tempfile_from_data_url(extract_generated_image_data_url(response), filename_root)
      png_tempfile = ImageProcessing::MiniMagick.source(raw_image_tempfile.path).convert("png").call

      {
        tempfile: png_tempfile,
        filename: "#{filename_root}-clean.png",
        filename_root: filename_root,
        content_type: "image/png",
        provider: "openrouter",
        model: configured_model,
        raw_response: response
      }
    end
  ensure
    raw_image_tempfile&.close!
  end

  private

  attr_reader :metadata_context, :prompt_context, :reference_photos, :source_photo

  def perform_request(model:, prompt:, data_url:)
    uri = URI.parse("#{base_url}/chat/completions")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = (uri.scheme == "https")
    http.read_timeout = 120
    http.open_timeout = 10

    request = Net::HTTP::Post.new(uri)
    request["Authorization"] = "Bearer #{api_key}"
    request["Content-Type"] = "application/json"
    request["HTTP-Referer"] = ENV["OPENROUTER_SITE_URL"] if ENV["OPENROUTER_SITE_URL"].present?
    request["X-Title"] = ENV["OPENROUTER_APP_NAME"] if ENV["OPENROUTER_APP_NAME"].present?
    request.body = request_body(model: model, prompt: prompt, data_url: data_url).to_json

    response = http.request(request)
    parsed = JSON.parse(response.body)

    return parsed if response.is_a?(Net::HTTPSuccess)

    error_message = parsed.dig("error", "message") || "OpenRouter request failed with status #{response.code}"
    raise error_message
  rescue JSON::ParserError
    raise "OpenRouter returned an unreadable image response."
  end

  def request_body(model:, prompt:, data_url:)
    {
      model: model,
      stream: false,
      modalities: %w[image text],
      messages: [
        {
          role: "system",
          content: "You create realistic apparel catalog images. Return one clean product photo."
        },
        {
          role: "user",
          content: request_content(prompt: prompt, data_url: data_url)
        }
      ]
    }
  end

  def generation_prompt
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

    <<~PROMPT
      Create a single realistic catalog-style PNG of the same clothing item shown in the reference image.

      Requirements:
      - Preserve the exact garment identity, including category, silhouette, fit, color, graphics, logos, trim, neckline, sleeve length, and material cues.
      - The output may look like a newly photographed studio product image, but it must still clearly be the same item.
      - Show only one item centered in frame.
      - Use a single clean plain studio background with only one of these two options: paper white or deep charcoal.
      - If the garment is light-colored, close to white, or needs darker contrast to stay clearly visible, choose a deep charcoal background.
      - Otherwise choose a paper-white background.
      - The background must be flat and uniform from edge to edge with no gradient, texture, wrinkles, floor line, spotlight, vignette, or lighting falloff.
      - Leave a clear visible margin of background around the entire garment so the item remains easy to read on a closet card.
      - Do not substitute a different background color.
      - Remove people, body parts, hangers, background clutter, extra garments, and props.
      - Do not add any cast shadow, floor shadow, contact shadow, drop shadow, glow, vignette, reflection, or halo behind or underneath the garment.
      - The garment should appear evenly lit and isolated with crisp edges.
      - Minimize harsh shadows, deep shading, and strong contrast on the garment itself.
      - Preserve natural seam definition and texture, but avoid dark shadowed regions on the garment that could blend into the background.
      - Keep the style photorealistic and suitable for an ecommerce product card.
      - Do not invent a different garment or change the dominant color/pattern.
      - Treat the structured fields and description below as identity constraints from an earlier identification pass.
      - The first image is the latest item-focused photo. Any additional images are original/reference context for the same item.
      - If the image and the text disagree, preserve the same garment identity as faithfully as possible instead of inventing a new item.

      #{details.join("\n")}
      #{metadata_lines.present? ? "\nCurrent metadata context:\n#{metadata_lines.join("\n")}" : ""}
      #{appearance_summary.present? ? "\nAppearance summary:\n#{appearance_summary}" : ""}
      #{hard_constraints.present? ? "\nHard constraints:\n#{hard_constraints.map { |constraint| "- #{constraint}" }.join("\n")}" : ""}
      #{soft_hints.present? ? "\nSoft hints:\n#{soft_hints.map { |hint| "- #{hint}" }.join("\n")}" : ""}
    PROMPT
  end

  def request_content(prompt:, data_url:)
    content = [
      {
        type: "text",
        text: prompt
      },
      {
        type: "text",
        text: "Latest item-focused photo:"
      },
      {
        type: "image_url",
        image_url: {
          url: data_url
        }
      }
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
    ENV.fetch("OPENROUTER_IMAGE_CLEAN_MODEL", DEFAULT_MODEL)
  end
end
