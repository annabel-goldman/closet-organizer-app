class ModelReferenceImage < ApplicationRecord
  MAX_REFERENCES = 3
  MAX_FILE_SIZE = 10.megabytes

  belongs_to :user
  has_one_attached :photo

  scope :ordered, -> { order(:position, :id) }

  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :position, uniqueness: { scope: :user_id }
  validate :photo_is_attached
  validate :photo_must_be_an_image
  validate :photo_size_within_limit
  validate :user_reference_limit, on: :create

  private

  def photo_is_attached
    errors.add(:photo, "is required") unless photo.attached?
  end

  def photo_must_be_an_image
    return unless photo.attached?
    return if photo.blob.content_type&.start_with?("image/")

    errors.add(:photo, "must be an image")
  end

  def photo_size_within_limit
    return unless photo.attached?
    return if photo.blob.byte_size <= MAX_FILE_SIZE

    errors.add(:photo, "must be 10 MB or smaller")
  end

  def user_reference_limit
    return unless user
    return if user.model_reference_images.where.not(id: id).count < MAX_REFERENCES

    errors.add(:base, "You can save up to #{MAX_REFERENCES} model reference photos")
  end
end
