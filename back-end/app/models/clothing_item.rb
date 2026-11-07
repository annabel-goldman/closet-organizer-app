class ClothingItem < ApplicationRecord
  belongs_to :user
  has_many :outfit_items, dependent: :destroy
  has_many :outfits, through: :outfit_items
  has_one_attached :photo
  has_one_attached :cleaned_photo
  has_many :image_versions,
    as: :imageable,
    class_name: "WardrobeImageVersion",
    dependent: :destroy,
    inverse_of: :imageable
  has_one :wardrobe_item_analysis, dependent: :destroy
  before_validation :apply_defaults, on: :create
  before_validation :normalize_category
  before_validation :normalize_tags
  before_validation :normalize_brand
  before_validation :normalize_style_notes
  after_commit :schedule_wardrobe_analysis, on: %i[create update]

  enum :size, {
    xs: 0,
    small: 1,
    medium: 2,
    large: 3,
    xl: 4,
    na: 5
  }
  enum :clean_image_status, {
    idle: 0,
    processing: 1,
    succeeded: 2,
    failed: 3
  }, prefix: true

  validates :name, presence: true, length: { maximum: InputLengthPolicy::MAX_CLOTHING_ITEM_NAME }
  validates :brand, length: { maximum: InputLengthPolicy::MAX_CLOTHING_ITEM_BRAND }, allow_blank: true
  validates :category, length: { maximum: InputLengthPolicy::MAX_CLOTHING_ITEM_CATEGORY }, allow_blank: true
  validates :style_notes, length: { maximum: InputLengthPolicy::MAX_CLOTHING_ITEM_STYLE_NOTES }, allow_blank: true
  validates :size, presence: true
  validate :tags_meet_length_policy
  validate :photo_must_be_an_image
  validate :photo_size_within_limit

  def display_photo_attachment
    active_image_version&.image || (cleaned_photo.attached? ? cleaned_photo : photo)
  end

  def source_photo_for_cleaning
    original_image_version&.image || photo
  end

  def active_image_version
    versions = ordered_image_versions
    versions.find(&:selected?) || versions.last
  end

  def original_image_version
    ordered_image_versions.find { |version| version.variant_kind == "original" }
  end

  def self.human_attribute_name(attribute, options = {})
    return "Visual description" if attribute.to_s == "style_notes"

    super
  end

  private

  def ordered_image_versions
    return image_versions.in_display_order.to_a unless association(:image_versions).loaded?

    image_versions.sort_by do |version|
      [ WardrobeImageVersion::KINDS.index(version.variant_kind) || WardrobeImageVersion::KINDS.length, version.id ]
    end
  end

  def photo_must_be_an_image
    return unless photo.attached?
    return if photo.blob.content_type&.start_with?("image/")

    errors.add(:photo, "must be an image")
  end

  def photo_size_within_limit
    return unless photo.attached?
    return if photo.blob.byte_size <= 10.megabytes

    errors.add(:photo, "must be 10 MB or smaller")
  end

  def normalize_tags
    self.tags = TagListNormalizer.call(tags)
  end

  def tags_meet_length_policy
    InputLengthPolicy.validate_tag_list(self, :tags, tags)
  end

  def normalize_brand
    self.brand = brand.to_s.strip.presence
  end

  def normalize_style_notes
    self.style_notes = style_notes.to_s.strip.presence
  end

  def apply_defaults
    self.size = :na if size.blank?
  end

  def normalize_category
    normalized_category = category.to_s.strip.downcase.presence
    self.category = normalized_category == "bag" ? "accessory" : normalized_category
  end

  def schedule_wardrobe_analysis
    WardrobeItemAnalysisScheduler.call(self)
  rescue StandardError => error
    Rails.logger.error("Unable to schedule wardrobe analysis for item #{id}: #{error.class}: #{error.message}")
  end
end
