class OutfitDecoration < ApplicationRecord
  belongs_to :outfit
  belongs_to :decoration

  validates :x, :y, numericality: { greater_than_or_equal_to: -25, less_than_or_equal_to: 100 }
  validates :width, numericality: { greater_than_or_equal_to: 5, less_than_or_equal_to: 60 }
  validates :rotation, numericality: { greater_than_or_equal_to: -180, less_than_or_equal_to: 180 }
  validates :layer_order, numericality: { greater_than_or_equal_to: 0, only_integer: true }
  validate :decoration_must_belong_to_outfit_owner

  private

  def decoration_must_belong_to_outfit_owner
    return unless outfit && decoration
    return if outfit.user_id == decoration.user_id

    errors.add(:decoration, "must belong to the outfit owner")
  end
end
