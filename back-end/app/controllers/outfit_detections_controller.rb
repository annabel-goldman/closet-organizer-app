class OutfitDetectionsController < ApplicationController
  before_action :require_login
  before_action :set_outfit_detection

  def generate_clean_image
    temporary_files = ManagedTempfiles.new

    source_photo = source_photo_for_cleaning(@outfit_detection, temporary_files)
    unless source_photo
      render json: { error: "This detection does not have a usable crop to clean." }, status: :unprocessable_content
      return
    end

    CleanImageAttachmentGenerator.call(
      record: @outfit_detection,
      source_photo: source_photo,
      prompt_context: ImageCleanPromptBuilder.for_detection(@outfit_detection),
      temporary_files: temporary_files
    )

    render json: payloads.outfit_detection(@outfit_detection.reload)
  rescue StandardError => error
    render json: { error: error.message }, status: :unprocessable_content
  ensure
    temporary_files&.close_all
  end

  private

  def set_outfit_detection
    @outfit_detection = OutfitDetection
      .joins(:outfit_upload)
      .find_by!(id: params[:id], outfit_uploads: { user_id: current_user.id })
  end

  def source_photo_for_cleaning(outfit_detection, temporary_files)
    return outfit_detection.cleaned_photo if outfit_detection.cleaned_photo.attached?

    crop_box = outfit_detection.preferred_preview_box
    return nil unless crop_box

    cropped_photo = ClothingItemPhotoCropper.call(
      outfit_detection.outfit_upload.source_photo,
      crop_box
    )
    PreparedImageSource.from_crop_result(cropped_photo, temporary_files: temporary_files)
  end
end
