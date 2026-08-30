class OutfitFolder < ApplicationRecord
  MAX_MAGAZINE_PAGES = 100
  MAGAZINE_ELEMENT_KEYS = %w[image title body].freeze
  MAGAZINE_POSITION_KEYS = %w[x y width].freeze
  MAGAZINE_IMAGE_MODES = %w[flatlay modeled].freeze
  MAGAZINE_PAGE_LAYOUT_KEYS = [ "image_mode", *MAGAZINE_ELEMENT_KEYS ].freeze
  MAGAZINE_ELEMENT_LAYOUT_KEYS = [ *MAGAZINE_POSITION_KEYS, "text" ].freeze

  belongs_to :user
  has_many :memberships,
    -> { order(:position, :id) },
    class_name: "OutfitFolderMembership",
    dependent: :destroy,
    inverse_of: :outfit_folder
  has_many :outfits, through: :memberships
  has_many :decorations,
    -> { order(:page_key, :layer_order, :id) },
    class_name: "OutfitFolderDecoration",
    dependent: :destroy,
    inverse_of: :outfit_folder

  validates :name, presence: true, length: { maximum: InputLengthPolicy::MAX_OUTFIT_NAME }
  validates :occasion, length: { maximum: InputLengthPolicy::MAX_OUTFIT_NAME }, allow_blank: true
  validates :notes, length: { maximum: InputLengthPolicy::MAX_OUTFIT_NOTES }, allow_blank: true
  validate :page_layouts_are_valid

  private

  def page_layouts_are_valid
    unless page_layouts.is_a?(Hash)
      errors.add(:page_layouts, "must be an object")
      return
    end

    if page_layouts.length > MAX_MAGAZINE_PAGES
      errors.add(:page_layouts, "contains too many pages")
      return
    end

    page_layouts.each do |raw_page_key, page_layout|
      page_key = raw_page_key.to_s
      unless page_key == "cover" || page_key.match?(/\Aoutfit:\d+\z/)
        errors.add(:page_layouts, "contains an invalid page key")
      end

      unless page_layout.is_a?(Hash)
        errors.add(:page_layouts, "contains an invalid page")
        next
      end
      page_layout = page_layout.stringify_keys

      if (page_layout.keys - MAGAZINE_PAGE_LAYOUT_KEYS).any?
        errors.add(:page_layouts, "contains an unsupported page setting")
      end

      image_mode = page_layout["image_mode"]
      if image_mode.present? && !MAGAZINE_IMAGE_MODES.include?(image_mode)
        errors.add(:page_layouts, "contains an invalid image mode")
      end

      MAGAZINE_ELEMENT_KEYS.each do |element_key|
        validate_magazine_element(page_layout[element_key]) if page_layout.key?(element_key)
      end
    end
  end

  def validate_magazine_element(element)
    unless element.is_a?(Hash)
      errors.add(:page_layouts, "contains an invalid element")
      return
    end
    element = element.stringify_keys

    if (element.keys - MAGAZINE_ELEMENT_LAYOUT_KEYS).any?
      errors.add(:page_layouts, "contains an unsupported element setting")
    end

    MAGAZINE_POSITION_KEYS.each do |position_key|
      next unless element.key?(position_key)

      value = Float(element[position_key], exception: false)
      errors.add(:page_layouts, "contains an invalid position") unless value&.between?(-50, 150)
    end

    text = element["text"]
    if text.present? && text.to_s.length > InputLengthPolicy::MAX_OUTFIT_NOTES
      errors.add(:page_layouts, "contains text that is too long")
    end
  end
end
