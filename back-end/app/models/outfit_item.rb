class OutfitItem < ApplicationRecord
  belongs_to :outfit
  belongs_to :clothing_item

  validates :clothing_item_id, uniqueness: { scope: :outfit_id }
  validates :layer_order, numericality: { greater_than_or_equal_to: 0, only_integer: true }
  validate :clothing_item_must_belong_to_outfit_user
  validate :collage_layout_must_be_complete
  validate :collage_layout_must_be_in_bounds

  def collage_layout_payload
    return nil unless collage_layout_present?

    {
      x: collage_x,
      y: collage_y,
      width: collage_width,
      height: collage_height,
      rotation: collage_rotation,
      layer_order: layer_order
    }
  end

  def collage_layout_present?
    [ collage_x, collage_y, collage_width, collage_height ].any?(&:present?)
  end

  private

  def clothing_item_must_belong_to_outfit_user
    return unless outfit && clothing_item
    return if outfit.user_id == clothing_item.user_id

    errors.add(:clothing_item_id, "must belong to the same user as the outfit")
  end

  def collage_layout_must_be_complete
    values = [ collage_x, collage_y, collage_width, collage_height ]
    return if values.all?(&:nil?) || values.none?(&:nil?)

    errors.add(:base, "Collage layout is incomplete")
  end

  def collage_layout_must_be_in_bounds
    return unless collage_layout_present?
    return if [ collage_x, collage_y, collage_width, collage_height ].any?(&:nil?)

    unless collage_x.between?(0.0, 100.0) && collage_y.between?(0.0, 100.0)
      errors.add(:base, "Collage layout origin must stay within the canvas")
    end

    unless collage_width.positive? && collage_width <= 100.0 && collage_height.positive? && collage_height <= 100.0
      errors.add(:base, "Collage layout size must stay within the canvas")
    end

    if collage_x + collage_width > 100.0 || collage_y + collage_height > 100.0
      errors.add(:base, "Collage layout must stay within the canvas")
    end
  end
end
