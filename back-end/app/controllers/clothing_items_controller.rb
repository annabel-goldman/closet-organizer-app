class ClothingItemsController < ApplicationController
  before_action :require_login
  before_action :set_clothing_item, only: %i[show update destroy generate_clean_image]

  def index
    @clothing_items = current_user.clothing_items.includes(:user).order(:name)
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

    CleanImageAttachmentGenerator.call(
      record: @clothing_item,
      source_photo: @clothing_item.source_photo_for_cleaning,
      prompt_context: ImageCleanPromptBuilder.for_clothing_item(@clothing_item)
    )

    render json: payloads.clothing_item(@clothing_item.reload)
  rescue StandardError => error
    render json: { error: error.message }, status: :unprocessable_content
  end

  private

  def set_clothing_item
    @clothing_item = current_user.clothing_items.find(params[:id])
  end

  def clothing_item_attributes
    base_params = params.require(:clothing_item).permit(:name, :size, :date, :user_id, :brand)
    tag_params = params.require(:clothing_item).permit(tags: [])[:tags]

    base_params.merge(
      tags: TagListNormalizer.call(tag_params.presence || params.dig(:clothing_item, :tags)),
      user_id: current_user.id
    )
  end

  def persist_clothing_item(clothing_item, status: :ok)
    temporary_files = ManagedTempfiles.new
    attach_photo_from_request(clothing_item, temporary_files)

    if clothing_item.errors.empty? && clothing_item.save
      remove_all_item_photos(clothing_item) if remove_photo_requested?
      render json: payloads.clothing_item(clothing_item), status: status
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
        reset_clean_image_state(clothing_item)
        attach_photo_from_detection(clothing_item, temporary_files)
      end

      return
    end

    uploaded_photo = params.dig(:clothing_item, :photo)
    return if uploaded_photo.blank?

    bounding_box = normalized_crop_box
    return if clothing_item.errors.any?

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

  def attach_photo_from_detection(clothing_item, temporary_files)
    unless source_outfit_detection.usable_candidate_box.present?
      clothing_item.errors.add(:base, "Selected detection does not have a usable crop yet")
      return
    end

    if source_outfit_detection.cleaned_photo.attached?
      PreparedImageSource.from_attachment(source_outfit_detection.cleaned_photo).attach_to(clothing_item.photo)
      return
    end

    cropped_photo = ClothingItemPhotoCropper.call(
      source_outfit_detection.outfit_upload.source_photo,
      source_outfit_detection.usable_crop_box
    )
    PreparedImageSource.from_crop_result(cropped_photo, temporary_files: temporary_files).attach_to(clothing_item.photo)
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
    clothing_item.clean_image_status = :idle
    clothing_item.clean_image_error_message = nil
    clothing_item.clean_image_provider = nil
    clothing_item.clean_image_model = nil
    clothing_item.clean_image_generated_at = nil
  end

  def remove_all_item_photos(clothing_item)
    clothing_item.photo.purge if clothing_item.photo.attached?
    reset_clean_image_state(clothing_item)
    clothing_item.save! if clothing_item.persisted?
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
end
