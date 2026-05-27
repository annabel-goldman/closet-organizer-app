class OutfitDetectionsController < ApplicationController
  before_action :require_login
  before_action :set_outfit_detection

  def generate_metadata_suggestions
    temporary_files = ManagedTempfiles.new
    source_photo = @outfit_detection.source_photo_for_cleaning(temporary_files: temporary_files)

    unless source_photo&.attached?
      render json: { error: "This detection does not have a usable crop to analyze." }, status: :unprocessable_content
      return
    end

    metadata_context = outfit_detection_ai_metadata_context(@outfit_detection).merge(
      ai_metadata_context_from_params(params[:ai_context])
    )

    render json: OpenrouterMetadataSuggester.call(
      source_photo,
      category_hint: @outfit_detection.category,
      reference_photos: [ @outfit_detection.outfit_upload.source_photo ],
      metadata_context: metadata_context
    )
  rescue StandardError => error
    render json: { error: error.message }, status: :unprocessable_content
  ensure
    temporary_files&.close_all
  end

  def generate_clean_image
    temporary_files = ManagedTempfiles.new

    source_photo = @outfit_detection.source_photo_for_cleaning(temporary_files: temporary_files)
    unless source_photo&.attached?
      render json: { error: "This detection does not have a usable crop to clean." }, status: :unprocessable_content
      return
    end

    metadata_context = outfit_detection_ai_metadata_context(@outfit_detection).merge(
      ai_metadata_context_from_params(params[:ai_context])
    )

    CleanImageAttachmentGenerator.call(
      record: @outfit_detection,
      source_photo: source_photo,
      prompt_context: ImageCleanPromptBuilder.for_detection(@outfit_detection),
      temporary_files: temporary_files,
      reference_photos: [ @outfit_detection.outfit_upload.source_photo ],
      metadata_context: metadata_context
    )

    render json: payloads.outfit_detection(@outfit_detection.reload)
  rescue StandardError => error
    render json: { error: error.message }, status: :unprocessable_content
  ensure
    temporary_files&.close_all
  end

  def generate_transparent_png
    source_photo = @outfit_detection.source_photo_for_transparent_png
    unless source_photo&.attached?
      render json: { error: "Run AI clean image before making a transparent PNG." }, status: :unprocessable_content
      return
    end

    TransparentPngAttachmentGenerator.call(
      record: @outfit_detection,
      source_photo: source_photo
    )

    render json: payloads.outfit_detection(@outfit_detection.reload)
  rescue StandardError => error
    render json: { error: error.message }, status: :unprocessable_content
  end

  private

  def set_outfit_detection
    @outfit_detection = OutfitDetection
      .joins(:outfit_upload)
      .find_by!(id: params[:id], outfit_uploads: { user_id: current_user.id })
  end
end
