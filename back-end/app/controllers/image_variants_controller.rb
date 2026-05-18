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

    generated = OpenrouterImageCleaner.call(
      source_photo,
      reference_photos: image_variant_reference_photos,
      metadata_context: ai_metadata_context_from_params(params[:ai_context])
    )
    tempfile = generated.fetch(:tempfile)
    tempfile.rewind

    render json: {
      filename: generated.fetch(:filename),
      content_type: generated.fetch(:content_type),
      data_url: data_url_for(tempfile, generated.fetch(:content_type))
    }
  rescue StandardError => error
    render json: { error: error.message }, status: :unprocessable_content
  ensure
    tempfile&.close!
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
end
