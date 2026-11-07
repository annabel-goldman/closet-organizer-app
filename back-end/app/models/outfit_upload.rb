class OutfitUpload < ApplicationRecord
  belongs_to :user
  has_one_attached :source_photo
  has_many :outfit_detections, -> { order(:position) }, dependent: :destroy

  enum :status, {
    pending: 0,
    processing: 1,
    succeeded: 2,
    failed: 3,
    cancelled: 4
  }

  validates :status, presence: true
  validate :source_photo_must_be_present
  validate :source_photo_must_be_an_image
  validate :source_photo_size_within_limit

  def analyze!
    OutfitUploadAnalyzer.call(self)
  end

  private

  def source_photo_must_be_present
    return if source_photo.attached?

    errors.add(:source_photo, "must be attached")
  end

  def source_photo_must_be_an_image
    return unless source_photo.attached?
    return if source_photo.blob.content_type&.start_with?("image/")

    errors.add(:source_photo, "must be an image")
  end

  def source_photo_size_within_limit
    return unless source_photo.attached?
    return if source_photo.blob.byte_size <= 10.megabytes

    errors.add(:source_photo, "must be 10 MB or smaller")
  end
end
