class ClothingItemsController < ApplicationController
  before_action :require_login
  before_action :set_clothing_item, only: %i[
    show update destroy generate_clean_image remove_image_background select_image_version generate_metadata_suggestions
  ]

  def index
    @clothing_items = current_user.clothing_items.includes(
      :user,
      { photo_attachment: :blob },
      { cleaned_photo_attachment: :blob },
      { image_versions: { image_attachment: :blob } }
    ).order(:name)
    render json: @clothing_items.map { |clothing_item| payloads.clothing_item(clothing_item) }
  end

  def show
    render json: payloads.clothing_item(@clothing_item)
  end

  def create
    @clothing_item = ClothingItem.new(clothing_item_attributes)
    persist_clothing_item(@clothing_item, status: :created)
  end

  def update
    @clothing_item.assign_attributes(clothing_item_attributes)
    persist_clothing_item(@clothing_item)
  end

  def destroy
    @clothing_item.destroy
    head :no_content
  end

  def generate_clean_image
    unless @clothing_item.source_photo_for_cleaning.attached?
      render json: { error: "This item does not have a photo to clean." }, status: :unprocessable_content
      return
    end

    metadata_context = clothing_item_ai_metadata_context(@clothing_item).merge(
      ai_metadata_context_from_params(params[:ai_context])
    )

    workflow = current_user.ai_workflows.create!(
      kind: "item_clean",
      subject: @clothing_item,
      requested_count: 1,
      provider: "openrouter",
      model: ENV.fetch("OPENROUTER_IMAGE_CLEAN_MODEL", OpenrouterImageCleaner::DEFAULT_MODEL),
      prompt_version: "item-clean-v1",
      metadata: {
        source: "item-detail",
        item_id: @clothing_item.id,
        item_name: @clothing_item.name,
        metadata_context: metadata_context,
        prompt_context: ImageCleanPromptBuilder.for_clothing_item(@clothing_item)
      }
    )
    workflow.initialize_stages!
    @clothing_item.update!(clean_image_status: :processing, clean_image_error_message: nil)
    CleanImageGenerationJob.perform_later(workflow.id)

    render json: payloads.ai_workflow(workflow), status: :accepted
  rescue ActiveRecord::RecordInvalid => error
    render_validation_errors(error.record)
  rescue StandardError => error
    render json: { error: error.message }, status: :unprocessable_content
  end

  def generate_metadata_suggestions
    unless @clothing_item.source_photo_for_cleaning.attached?
      render json: { error: "This item does not have a photo to analyze." }, status: :unprocessable_content
      return
    end

    render json: OpenrouterMetadataSuggester.call(
      @clothing_item.source_photo_for_cleaning,
      reference_photos: clothing_item_reference_photos,
      metadata_context: clothing_item_ai_metadata_context(@clothing_item).merge(
        ai_metadata_context_from_params(params[:ai_context])
      )
    )
  rescue StandardError => error
    render json: { error: error.message }, status: :unprocessable_content
  end

  def remove_image_background
    generated_version = @clothing_item.image_versions.find_by(variant_kind: "generated")
    unless generated_version&.image&.attached?
      render json: { error: "Generate an AI item image before removing its background." }, status: :unprocessable_content
      return
    end

    temporary_files = ManagedTempfiles.new
    processed = CleanImageBackgroundRemover.call(
      generated_version.image,
      filename_root: "item-#{@clothing_item.id}-generated",
      temporary_files: temporary_files
    )
    transparent_version = WardrobeImageVersionPublisher.call(
      record: @clothing_item,
      variant_kind: "transparent",
      source: processed.fetch(:tempfile),
      parent: generated_version,
      provider: generated_version.provider,
      model: generated_version.model,
      metadata: { background_removed_at: Time.current.iso8601 }
    )
    @clothing_item.cleaned_photo.attach(transparent_version.image.blob)
    render json: payloads.clothing_item(@clothing_item.reload)
  rescue StandardError => error
    render json: { error: error.message }, status: :unprocessable_content
  ensure
    temporary_files&.close_all
  end

  def select_image_version
    version = @clothing_item.image_versions.find_by!(variant_kind: params[:variant_kind])
    version.select!
    render json: payloads.clothing_item(@clothing_item.reload)
  end

  private

  def set_clothing_item
    @clothing_item = current_user.clothing_items.find(params[:id])
  end

  def clothing_item_attributes
    base_params = params.require(:clothing_item).permit(:name, :category, :size, :date, :user_id, :brand, :style_notes)
    tag_params = params.require(:clothing_item).permit(tags: [])[:tags]

    base_params.merge(
      tags: TagListNormalizer.call(tag_params.presence || params.dig(:clothing_item, :tags)),
      user_id: current_user.id
    )
  end

  def persist_clothing_item(clothing_item, status: :ok)
    temporary_files = ManagedTempfiles.new
    attach_photo_from_request(clothing_item, temporary_files)
    prepare_requested_cleaned_photo_state(clothing_item)

    if clothing_item.errors.empty? && clothing_item.save
      apply_post_save_photo_changes(clothing_item)
      sync_image_versions(clothing_item)
      render json: payloads.clothing_item(clothing_item.reload), status: status
    else
      render_validation_errors(clothing_item)
    end
  ensure
    temporary_files.close_all
  end

  def attach_photo_from_request(clothing_item, temporary_files)
    if params.dig(:clothing_item, :source_outfit_detection_id).present?
      return if clothing_item.errors.any?

      if source_outfit_detection.present?
        clothing_item.source_outfit_upload_id = source_outfit_detection.outfit_upload_id
        clothing_item.source_outfit_detection_id = source_outfit_detection.id
        clothing_item.category = source_outfit_detection.category if clothing_item.category.blank?
        reset_clean_image_state(clothing_item)
        attach_photo_from_detection(clothing_item)
      end

      return
    end

    uploaded_photo = params.dig(:clothing_item, :photo)
    return if uploaded_photo.blank?

    bounding_box = normalized_crop_box
    return if clothing_item.errors.any?

    clear_detection_source!(clothing_item)
    reset_clean_image_state(clothing_item)

    if bounding_box
      attach_cropped_photo(clothing_item, uploaded_photo, bounding_box, temporary_files)
    else
      clothing_item.photo.attach(uploaded_photo)
    end
  rescue ClothingItemPhotoCropper::Error, ArgumentError => error
    clothing_item.errors.add(:photo, "could not be cropped: #{error.message}")
  end

  def attach_cropped_photo(clothing_item, uploaded_photo, bounding_box, temporary_files)
    cropped_photo = ClothingItemPhotoCropper.call(uploaded_photo, bounding_box)
    PreparedImageSource.from_crop_result(cropped_photo, temporary_files: temporary_files).attach_to(clothing_item.photo)
  end

  def attach_photo_from_detection(clothing_item)
    source_photo = source_outfit_detection.outfit_upload.source_photo
    unless source_photo.attached?
      clothing_item.errors.add(:base, "Selected detection does not have a usable source photo")
      return
    end

    clothing_item.photo.attach(source_photo.blob)
  end

  def normalized_crop_box
    raw_values = {
      x: params.dig(:clothing_item, :crop_x),
      y: params.dig(:clothing_item, :crop_y),
      width: params.dig(:clothing_item, :crop_width),
      height: params.dig(:clothing_item, :crop_height)
    }

    return nil if raw_values.values.all?(&:blank?)
    return invalid_crop_box if raw_values.values.any?(&:blank?)

    box = raw_values.transform_values { |value| Float(value) }
    return invalid_crop_box unless box.values.all?(&:finite?)
    return invalid_crop_box if box[:x].negative? || box[:y].negative?
    return invalid_crop_box unless box[:width].positive? && box[:height].positive?
    return invalid_crop_box if box[:x] + box[:width] > 1.0 || box[:y] + box[:height] > 1.0

    box
  rescue ArgumentError, TypeError
    invalid_crop_box
  end

  def invalid_crop_box
    @clothing_item.errors.add(:base, "Crop box is invalid")
    nil
  end

  def reset_clean_image_state(clothing_item)
    clothing_item.cleaned_photo.purge if clothing_item.cleaned_photo.attached?
    clothing_item.image_versions.where.not(variant_kind: "original").destroy_all if clothing_item.persisted?
    clothing_item.clean_image_status = :idle
    clothing_item.clean_image_error_message = nil
    clothing_item.clean_image_provider = nil
    clothing_item.clean_image_model = nil
    clothing_item.clean_image_generated_at = nil
  end

  def remove_all_item_photos(clothing_item)
    clothing_item.photo.purge if clothing_item.photo.attached?
    reset_clean_image_state(clothing_item)
    clothing_item.image_versions.destroy_all
    clothing_item.save! if clothing_item.persisted?
  end

  def prepare_requested_cleaned_photo_state(clothing_item)
    return if requested_cleaned_photo.blank?

    clothing_item.clean_image_status = :succeeded
    clothing_item.clean_image_error_message = nil
    clothing_item.clean_image_provider = nil
    clothing_item.clean_image_model = nil
    clothing_item.clean_image_generated_at = Time.current
  end

  def apply_post_save_photo_changes(clothing_item)
    if remove_photo_requested?
      remove_all_item_photos(clothing_item)
      return
    end

    if remove_cleaned_photo_requested?
      remove_cleaned_photo(clothing_item)
      return
    end

    attach_requested_cleaned_photos(clothing_item)
  end

  def attach_requested_cleaned_photos(clothing_item)
    return if requested_cleaned_photo.blank?

    clothing_item.cleaned_photo.purge if clothing_item.cleaned_photo.attached?
    attach_uploaded_image(clothing_item.cleaned_photo, requested_cleaned_photo)
  end

  def sync_image_versions(clothing_item)
    sync_original_version(clothing_item)
    transfer_detection_versions(clothing_item) if source_outfit_detection.present?
    sync_uploaded_version(clothing_item, "generated", params.dig(:clothing_item, :generated_photo))
    sync_uploaded_version(clothing_item, "transparent", requested_cleaned_photo)

    requested_kind = params.dig(:clothing_item, :selected_image_kind).presence
    selected_version = if requested_kind
      clothing_item.image_versions.find_by(variant_kind: requested_kind)
    else
      clothing_item.image_versions.find_by(selected: true)
    end
    selected_version ||= clothing_item.image_versions.find_by(variant_kind: "transparent")
    selected_version ||= clothing_item.image_versions.find_by(variant_kind: "generated")
    selected_version ||= clothing_item.image_versions.find_by(variant_kind: "original")
    selected_version&.select!
  end

  def sync_original_version(clothing_item)
    return unless clothing_item.photo.attached?
    return if clothing_item.image_versions.exists?(variant_kind: "original") &&
      params.dig(:clothing_item, :photo).blank? && source_outfit_detection.blank?

    WardrobeImageVersionPublisher.call(
      record: clothing_item,
      variant_kind: "original",
      source: clothing_item.photo,
      selected: clothing_item.image_versions.none?,
      metadata: { source: source_outfit_detection.present? ? "detected_source_photo" : "uploaded_photo" }
    )
  end

  def transfer_detection_versions(clothing_item)
    source_outfit_detection.image_versions.in_display_order.each do |source_version|
      next if source_version.variant_kind == "original"
      next unless source_version.image.attached?

      parent = source_version.parent && clothing_item.image_versions.find_by(variant_kind: source_version.parent.variant_kind)
      WardrobeImageVersionPublisher.call(
        record: clothing_item,
        variant_kind: source_version.variant_kind,
        source: source_version.image,
        parent: parent,
        selected: source_version.selected,
        provider: source_version.provider,
        model: source_version.model,
        metadata: source_version.metadata.merge("source_detection_id" => source_outfit_detection.id)
      )
    end

    if source_outfit_detection.cleaned_photo.attached? &&
      !clothing_item.image_versions.exists?(variant_kind: "transparent")
      WardrobeImageVersionPublisher.call(
        record: clothing_item,
        variant_kind: "transparent",
        source: source_outfit_detection.cleaned_photo,
        parent: clothing_item.image_versions.find_by(variant_kind: "generated"),
        selected: true,
        metadata: { source: "legacy_detection_cleaned_photo", source_detection_id: source_outfit_detection.id }
      )
    end

    transparent_version = clothing_item.image_versions.find_by(variant_kind: "transparent")
    clothing_item.cleaned_photo.attach(transparent_version.image.blob) if transparent_version&.image&.attached?
  end

  def sync_uploaded_version(clothing_item, variant_kind, uploaded_file)
    return if uploaded_file.blank?

    parent_kind = variant_kind == "generated" ? "original" : "generated"
    parent = clothing_item.image_versions.find_by(variant_kind: parent_kind)
    WardrobeImageVersionPublisher.call(
      record: clothing_item,
      variant_kind: variant_kind,
      source: uploaded_file,
      parent: parent,
      selected: params.dig(:clothing_item, :selected_image_kind).to_s == variant_kind,
      metadata: { source: "image_editor" }
    )
  end

  def attach_uploaded_image(attachment, uploaded_file)
    uploaded_file.tempfile.rewind if uploaded_file.respond_to?(:tempfile)
    attachment.attach(
      io: uploaded_file,
      filename: uploaded_file.original_filename,
      content_type: uploaded_file.content_type.presence || "image/png"
    )
  end

  def remove_cleaned_photo(clothing_item)
    clothing_item.cleaned_photo.purge if clothing_item.cleaned_photo.attached?
    clothing_item.image_versions.find_by(variant_kind: "transparent")&.destroy
    clothing_item.image_versions.find_by(variant_kind: "generated")&.select!
    clothing_item.update!(
      clean_image_status: :idle,
      clean_image_error_message: nil,
      clean_image_provider: nil,
      clean_image_model: nil,
      clean_image_generated_at: nil
    )
  end

  def source_outfit_detection
    detection_id = params.dig(:clothing_item, :source_outfit_detection_id)
    return @source_outfit_detection if defined?(@source_outfit_detection)
    return @source_outfit_detection = nil if detection_id.blank?

    @source_outfit_detection = OutfitDetection
      .joins(:outfit_upload)
      .find_by(id: detection_id, outfit_uploads: { user_id: current_user.id })
    return @source_outfit_detection if @source_outfit_detection

    @clothing_item.errors.add(:base, "Selected detection could not be found")
    nil
  end

  def remove_photo_requested?
    ActiveModel::Type::Boolean.new.cast(params.dig(:clothing_item, :remove_photo))
  end

  def remove_cleaned_photo_requested?
    ActiveModel::Type::Boolean.new.cast(params.dig(:clothing_item, :remove_cleaned_photo))
  end

  def requested_cleaned_photo
    params.dig(:clothing_item, :cleaned_photo)
  end

  def clothing_item_reference_photos
    source_upload = clothing_item_source_outfit_upload
    if source_upload&.source_photo&.attached?
      return [ source_upload.source_photo ]
    end

    return [] unless @clothing_item.photo.attached?
    return [] unless @clothing_item.source_photo_for_cleaning.attached?
    return [] if @clothing_item.source_photo_for_cleaning.blob == @clothing_item.photo.blob

    [ @clothing_item.photo ]
  end

  def clothing_item_source_outfit_upload
    return unless @clothing_item.source_outfit_upload_id.present?

    current_user.outfit_uploads.find_by(id: @clothing_item.source_outfit_upload_id)
  end

  def clear_detection_source!(clothing_item)
    clothing_item.source_outfit_upload_id = nil
    clothing_item.source_outfit_detection_id = nil
  end
end
