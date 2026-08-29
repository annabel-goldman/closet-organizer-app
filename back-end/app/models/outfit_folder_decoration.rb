class OutfitFolderDecoration < ApplicationRecord
  MAX_IMAGE_SIZE = 10.megabytes

  belongs_to :outfit_folder
  has_one_attached :image

  validates :page_key, presence: true, length: { maximum: 80 }, format: { with: /\A(?:cover|outfit:\d+)\z/ }
  validates :x, :y, numericality: { greater_than_or_equal_to: -25, less_than_or_equal_to: 100 }
  validates :width, numericality: { greater_than_or_equal_to: 5, less_than_or_equal_to: 60 }
  validates :rotation, numericality: { greater_than_or_equal_to: -180, less_than_or_equal_to: 180 }
  validates :layer_order, numericality: { greater_than_or_equal_to: 0, only_integer: true }
  validate :image_must_be_present
  validate :image_must_be_valid
  validate :outfit_page_must_belong_to_folder

  private

  def image_must_be_present
    errors.add(:image, "must be attached") unless image.attached?
  end

  def image_must_be_valid
    return unless image.attached?

    errors.add(:image, "must be an image") unless image.blob.content_type&.start_with?("image/")
    errors.add(:image, "must be 10 MB or smaller") if image.blob.byte_size > MAX_IMAGE_SIZE
  end

  def outfit_page_must_belong_to_folder
    return unless page_key.to_s.start_with?("outfit:") && outfit_folder

    outfit_id = page_key.delete_prefix("outfit:").to_i
    return if outfit_folder.outfit_ids.include?(outfit_id)

    errors.add(:page_key, "must reference an outfit in this folder")
  end
end
