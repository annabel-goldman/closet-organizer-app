class OutfitDetectionsController < ApplicationController
  before_action :require_login
  before_action :set_outfit_detection

  def generate_metadata_suggestions
    source_photo = source_photo_for_processing(@outfit_detection)

    unless source_photo
      render json: { error: "This detection does not have a usable source photo to analyze." }, status: :unprocessable_content
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
  end

  def generate_clean_image
    temporary_files = ManagedTempfiles.new
    generate_image_version!(temporary_files)
    remove_background_version!(temporary_files)

    render json: payloads.outfit_detection(@outfit_detection.reload)
  rescue StandardError => error
    render json: { error: error.message }, status: :unprocessable_content
  ensure
    temporary_files&.close_all
  end

  def generate_image
    temporary_files = ManagedTempfiles.new
    generate_image_version!(temporary_files)
    render json: payloads.outfit_detection(@outfit_detection.reload)
  rescue StandardError => error
    mark_clean_failure(error)
    render json: { error: error.message }, status: :unprocessable_content
  ensure
    temporary_files&.close_all
  end

  def remove_image_background
    temporary_files = ManagedTempfiles.new
    remove_background_version!(temporary_files)
    render json: payloads.outfit_detection(@outfit_detection.reload)
  rescue StandardError => error
    mark_clean_failure(error)
    render json: { error: error.message }, status: :unprocessable_content
  ensure
    temporary_files&.close_all
  end

  def select_image_version
    version = @outfit_detection.image_versions.find_by!(variant_kind: params[:variant_kind])
    version.select!
    render json: payloads.outfit_detection(@outfit_detection.reload)
  end

  private

  def set_outfit_detection
    @outfit_detection = OutfitDetection
      .joins(:outfit_upload)
      .find_by!(id: params[:id], outfit_uploads: { user_id: current_user.id })
  end

  def source_photo_for_processing(outfit_detection)
    original_version = outfit_detection.image_versions.find_by(variant_kind: "original")
    return original_version.image if original_version&.image&.attached?

    source_photo = outfit_detection.outfit_upload.source_photo
    return nil unless source_photo.attached?

    WardrobeImageVersionPublisher.call(
      record: outfit_detection,
      variant_kind: "original",
      source: source_photo,
      selected: outfit_detection.image_versions.none?,
      metadata: { source: "detected_source_photo" }
    ).image
  end

  def generate_image_version!(temporary_files)
    source_photo = source_photo_for_processing(@outfit_detection)
    raise "This detection does not have a usable source photo to generate." unless source_photo

    @outfit_detection.update!(clean_image_status: :processing, clean_image_error_message: nil)
    generated = OpenrouterImageCleaner.call(
      source_photo,
      prompt_context: ImageCleanPromptBuilder.for_detection(@outfit_detection),
      reference_photos: [ @outfit_detection.outfit_upload.source_photo ],
      metadata_context: outfit_detection_ai_metadata_context(@outfit_detection).merge(
        ai_metadata_context_from_params(params[:ai_context])
      )
    )
    generated_tempfile = temporary_files.track(generated.fetch(:tempfile))
    original_version = @outfit_detection.image_versions.find_by!(variant_kind: "original")
    WardrobeImageVersionPublisher.call(
      record: @outfit_detection,
      variant_kind: "generated",
      source: generated_tempfile,
      parent: original_version,
      provider: generated.fetch(:provider),
      model: generated.fetch(:model),
      metadata: { generated_at: Time.current.iso8601 }
    )
    @outfit_detection.update!(
      clean_image_status: :succeeded,
      clean_image_error_message: nil,
      clean_image_provider: generated.fetch(:provider),
      clean_image_model: generated.fetch(:model),
      clean_image_generated_at: Time.current
    )
  end

  def remove_background_version!(temporary_files)
    generated_version = @outfit_detection.image_versions.find_by(variant_kind: "generated")
    raise "Generate an AI item image before removing its background." unless generated_version&.image&.attached?

    @outfit_detection.update!(clean_image_status: :processing, clean_image_error_message: nil)
    processed = CleanImageBackgroundRemover.call(
      generated_version.image,
      filename_root: "detection-#{@outfit_detection.id}-generated",
      temporary_files: temporary_files
    )
    processed_tempfile = temporary_files.track(processed.fetch(:tempfile))
    transparent_version = WardrobeImageVersionPublisher.call(
      record: @outfit_detection,
      variant_kind: "transparent",
      source: processed_tempfile,
      parent: generated_version,
      provider: generated_version.provider,
      model: generated_version.model,
      metadata: { background_removed_at: Time.current.iso8601 }
    )
    @outfit_detection.cleaned_photo.attach(transparent_version.image.blob)
    @outfit_detection.update!(clean_image_status: :succeeded, clean_image_error_message: nil)
  end

  def mark_clean_failure(error)
    @outfit_detection.update(
      clean_image_status: :failed,
      clean_image_error_message: error.message
    )
  end
end
