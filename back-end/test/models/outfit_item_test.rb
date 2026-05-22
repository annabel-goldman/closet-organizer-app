require "test_helper"

class OutfitItemTest < ActiveSupport::TestCase
  test "fixture outfit item is valid" do
    assert outfit_items(:one).valid?
  end

  test "clothing item is unique per outfit" do
    duplicate = OutfitItem.new(outfit: outfits(:one), clothing_item: clothing_items(:one))

    assert_not duplicate.valid?
    assert_includes duplicate.errors[:clothing_item_id], "has already been taken"
  end

  test "clothing item must belong to the same user as outfit" do
    invalid = OutfitItem.new(outfit: outfits(:one), clothing_item: clothing_items(:two))

    assert_not invalid.valid?
    assert_includes invalid.errors[:clothing_item_id], "must belong to the same user as the outfit"
  end

  test "collage layout must be complete" do
    invalid = OutfitItem.new(
      outfit: outfits(:one),
      clothing_item: clothing_items(:one),
      collage_x: 10,
      collage_y: 12
    )

    assert_not invalid.valid?
    assert_includes invalid.errors[:base], "Collage layout is incomplete"
  end

  test "collage layout must stay within bounds" do
    invalid = OutfitItem.new(
      outfit: outfits(:one),
      clothing_item: clothing_items(:one),
      collage_x: 70,
      collage_y: 10,
      collage_width: 40,
      collage_height: 30
    )

    assert_not invalid.valid?
    assert_includes invalid.errors[:base], "Collage layout must stay within the canvas"
  end
end
