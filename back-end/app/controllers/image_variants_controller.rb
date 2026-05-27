require "base64"

class ImageVariantsController < ApplicationController
  before_action :require_login

  def metadata_suggestions
    source_photo = params.dig(:image_variant, :source_photo)
    if source_photo.blank?
      render json: { error: "Select an image before using AI autofill." }, status: :unprocessable_content
      return
    end

    render json: OpenrouterMetadataSuggester.call(
      source_photo,
      category_hint: params.dig(:image_variant, :category_hint),
      reference_photos: image_variant_reference_photos,
      metadata_context: ai_metadata_context_from_params(params[:ai_context])
    )
  rescue StandardError => error
    render json: { error: error.message }, status: :unprocessable_content
  end

  def preview
    source_photo = params.dig(:image_variant, :source_photo)
    if source_photo.blank?
      render json: { error: "Select an image before using the AI cleaner." }, status: :unprocessable_content
      return
    end

    temporary_files = ManagedTempfiles.new
    generated = CleanImageVariantSetGenerator.call(
      source_photo,
      reference_photos: image_variant_reference_photos,
      metadata_context: ai_metadata_context_from_params(params[:ai_context]),
      temporary_files: temporary_files
    )
    display = generated.fetch(:display)
    working = generated.fetch(:working)
    display_tempfile = temporary_files.track(display.fetch(:tempfile))
    display_tempfile.rewind
    working_tempfile = temporary_files.track(working.fetch(:tempfile))
    working_tempfile.rewind

    render json: {
      filename: display.fetch(:filename),
      content_type: display.fetch(:content_type),
      data_url: data_url_for(display_tempfile, display.fetch(:content_type)),
      working_filename: working.fetch(:filename),
      working_content_type: working.fetch(:content_type),
      working_data_url: data_url_for(working_tempfile, working.fetch(:content_type)),
      clean_image_variant: "cleaned",
      clean_image_cutout_fallback: false
    }
  rescue StandardError => error
    render json: { error: error.message }, status: :unprocessable_content
  ensure
    temporary_files&.close_all
  end

  def transparent_preview
    source_photo = params.dig(:image_variant, :source_photo)
    if source_photo.blank?
      render json: { error: "Select a cleaned image before making a transparent PNG." }, status: :unprocessable_content
      return
    end

    temporary_files = ManagedTempfiles.new
    processed = TransparentPngVariantGenerator.call(
      source_photo,
      filename_root: filename_root,
      temporary_files: temporary_files
    )
    tempfile = temporary_files.track(processed.fetch(:tempfile))
    tempfile.rewind

    render json: {
      filename: processed.fetch(:filename),
      content_type: processed.fetch(:content_type),
      data_url: data_url_for(tempfile, processed.fetch(:content_type)),
      clean_image_variant: processed.fetch(:image_variant),
      clean_image_cutout_fallback: processed.fetch(:cutout_fallback)
    }
  rescue StandardError => error
    render json: { error: error.message }, status: :unprocessable_content
  ensure
    temporary_files&.close_all
  end

  private

  def data_url_for(tempfile, content_type)
    encoded = Base64.strict_encode64(tempfile.read)
    "data:#{content_type};base64,#{encoded}"
  end

  def image_variant_reference_photos
    original_source_photo = params.dig(:image_variant, :original_source_photo)
    original_source_photo.present? ? [ original_source_photo ] : []
  end

  def filename_root
    source_photo = params.dig(:image_variant, :source_photo)
    File.basename(source_photo.original_filename.to_s, ".*").presence || "item-clean"
  end
end
