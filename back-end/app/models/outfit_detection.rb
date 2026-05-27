class OutfitDetection < ApplicationRecord
  belongs_to :outfit_upload
  has_one_attached :cleaned_photo
  has_one_attached :cleaned_working_photo

  enum :crop_status, {
    pending: 0,
    refined: 1,
    verified: 2,
    rejected: 3,
    failed: 4
  }, prefix: true
  enum :clean_image_status, {
    idle: 0,
    processing: 1,
    succeeded: 2,
    failed: 3
  }, prefix: true

  validates :category, presence: true
  validates :position, presence: true
  validates :crop_attempts, numericality: { greater_than_or_equal_to: 0 }
  validate :legacy_bounding_box_must_be_normalized
  validate -> { validate_box(:coarse) }
  validate -> { validate_box(:refined) }
  validate -> { validate_box(:final) }

  def bounding_box
    preferred_preview_box
  end

  def preferred_preview_box
    final_box || refined_box || coarse_box
  end

  def coarse_box
    box_from_columns(:coarse) || legacy_box
  end

  def refined_box
    box_from_columns(:refined)
  end

  def final_box
    box_from_columns(:final)
  end

  def usable_crop_box
    final_box || refined_box || coarse_box
  end

  def crop_ready?
    usable_candidate_box.present?
  end

  def usable_candidate_box
    final_box || refined_box || coarse_box
  end

  def source_photo_for_cleaning(temporary_files:)
    crop_box = preferred_preview_box
    return nil unless crop_box

    cropped_photo = ClothingItemPhotoCropper.call(
      outfit_upload.source_photo,
      crop_box
    )
    PreparedImageSource.from_crop_result(cropped_photo, temporary_files: temporary_files)
  end

  def source_photo_for_clothing_item(temporary_files:)
    return PreparedImageSource.from_attachment(cleaned_photo) if cleaned_photo.attached?

    source_photo_for_cleaning(temporary_files: temporary_files)
  end

  def source_photo_for_transparent_png
    return cleaned_working_photo if cleaned_working_photo.attached?

    cleaned_photo.attached? ? cleaned_photo : nil
  end

  private

  def box_from_columns(prefix)
    x = public_send("#{prefix}_bbox_x")
    y = public_send("#{prefix}_bbox_y")
    width = public_send("#{prefix}_bbox_width")
    height = public_send("#{prefix}_bbox_height")
    box_values = [ x, y, width, height ]
    return nil if box_values.all?(&:nil?)

    {
      x: x,
      y: y,
      width: width,
      height: height
    }
  end

  def legacy_box
    values = [ bbox_x, bbox_y, bbox_width, bbox_height ]
    return nil if values.all?(&:nil?)

    {
      x: bbox_x,
      y: bbox_y,
      width: bbox_width,
      height: bbox_height
    }
  end

  def legacy_bounding_box_must_be_normalized
    values = [ bbox_x, bbox_y, bbox_width, bbox_height ]
    return if values.all?(&:nil?)

    validate_box_values(values, "legacy bounding box")
  end

  def validate_box(prefix)
    values = [
      public_send("#{prefix}_bbox_x"),
      public_send("#{prefix}_bbox_y"),
      public_send("#{prefix}_bbox_width"),
      public_send("#{prefix}_bbox_height")
    ]
    return if values.all?(&:nil?)

    validate_box_values(values, "#{prefix} bounding box")
  end

  def validate_box_values(values, label)
    x, y, width, height = values

    if values.any?(&:nil?)
      errors.add(:base, "#{label} is incomplete")
      return
    end

    unless x.between?(0.0, 1.0) && y.between?(0.0, 1.0)
      errors.add(:base, "#{label} origin must be between 0 and 1")
    end

    unless width.positive? && width <= 1.0 && height.positive? && height <= 1.0
      errors.add(:base, "#{label} size must be between 0 and 1")
    end

    if x + width > 1.0 || y + height > 1.0
      errors.add(:base, "#{label} must stay within the image bounds")
    end
  end
end
