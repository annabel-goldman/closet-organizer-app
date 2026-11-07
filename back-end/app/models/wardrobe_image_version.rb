class WardrobeImageVersion < ApplicationRecord
  KINDS = %w[original generated transparent].freeze

  belongs_to :imageable, polymorphic: true, touch: true
  belongs_to :parent, class_name: "WardrobeImageVersion", optional: true
  has_many :children,
    class_name: "WardrobeImageVersion",
    foreign_key: :parent_id,
    dependent: :nullify,
    inverse_of: :parent
  has_one_attached :image

  validates :variant_kind, presence: true, inclusion: { in: KINDS }
  validates :variant_kind, uniqueness: { scope: %i[imageable_type imageable_id] }
  validate :image_must_be_attached

  scope :in_display_order, -> { order(Arel.sql("CASE variant_kind WHEN 'original' THEN 0 WHEN 'generated' THEN 1 ELSE 2 END")) }

  def select!
    transaction do
      imageable.image_versions.where.not(id: id).update_all(selected: false, updated_at: Time.current)
      update!(selected: true)
    end
    WardrobeItemAnalysisScheduler.call(imageable) if imageable.is_a?(ClothingItem)
  end

  private

  def image_must_be_attached
    errors.add(:image, "must be attached") unless image.attached?
  end
end
