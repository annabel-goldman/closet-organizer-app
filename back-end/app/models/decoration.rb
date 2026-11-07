class Decoration < ApplicationRecord
  MAX_IMAGE_SIZE = 10.megabytes

  belongs_to :user
  has_one_attached :image
  has_many :outfit_decorations, dependent: :destroy
  has_many :outfit_folder_decorations, dependent: :destroy

  validates :name, presence: true, length: { maximum: InputLengthPolicy::MAX_OUTFIT_NAME }
  validate :image_must_be_present
  validate :image_must_be_a_png

  private

  def image_must_be_present
    errors.add(:image, "must be attached") unless image.attached?
  end

  def image_must_be_a_png
    return unless image.attached?

    errors.add(:image, "must be a PNG") unless image.blob.content_type == "image/png"
    errors.add(:image, "must be 10 MB or smaller") if image.blob.byte_size > MAX_IMAGE_SIZE
  end
end
