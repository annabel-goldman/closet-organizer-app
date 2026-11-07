require "test_helper"

class OutfitStructureTest < ActiveSupport::TestCase
  Item = Data.define(:id, :user_id, :category, :name, :style_notes, :tags, :wardrobe_item_analysis)

  def item(id, category, name = category, user_id: 1)
    Item.new(id, user_id, category, name, "", [], nil)
  end

  test "an omitted dress anchor is restored instead of returning only accessories" do
    brief = { "anchor" => { "category" => "dress", "description" => "evening dress" }, "garment_roles" => [ OutfitStructure.role("accessory") ] }
    assert_includes OutfitStructure.roles(brief).pluck("category"), "dress"
    refute OutfitStructure.valid?([ item(1, "accessory"), item(2, "shoes") ], brief: brief)
    assert OutfitStructure.valid?([ item(1, "accessory"), item(2, "shoes"), item(3, "dress") ], brief: brief)
  end

  test "a bag cannot fill a hat role and a locked bag does not cover it" do
    role = OutfitStructure.role("accessory").merge("name" => "hat", "description" => "felt hat")
    refute OutfitStructure.matches?(item(1, "accessory", "Leather Handbag"), role)
    assert OutfitStructure.matches?(item(2, "accessory", "Felt Hat"), role)
  end

  test "unknown prop roles do not match arbitrary accessories" do
    bag = item(1, "accessory", "Black Leather Shoulder Bag")
    refute OutfitStructure.matches?(bag, OutfitStructure.role("accessory").merge("name" => "Broomstick"))
    refute OutfitStructure.matches?(bag, OutfitStructure.role("accessory").merge("name" => "Umbrella"))
    assert OutfitStructure.matches?(bag, OutfitStructure.role("accessory"))
  end

  test "partial combinations are eligible but ownership kept items and exclusions are still enforced" do
    partial = [ item(1, "top", "Black Sweater") ]
    assert OutfitStructure.eligible?(partial, brief: {}, user_id: 1, locked_ids: [ 1 ])
    refute OutfitStructure.eligible?(partial, brief: {}, user_id: 2)
    refute OutfitStructure.eligible?(partial, brief: {}, excluded_ids: [ 1 ])
    refute OutfitStructure.eligible?(partial, brief: {}, locked_ids: [ 2 ])
    refute OutfitStructure.eligible?(partial, brief: { "excluded_item_terms" => [ "sweater" ] })
    refute OutfitStructure.eligible?([], brief: {})
    assert_match(/incomplete outfit/, OutfitStructure.limitations(partial, {}).join)
  end

  test "coverage ownership exclusions and locked IDs cannot be overridden by ranking" do
    items = [ item(1, "top"), item(2, "bottom"), item(3, "shoes") ]
    assert OutfitStructure.valid?(items, brief: {}, user_id: 1, locked_ids: [ 1 ])
    refute OutfitStructure.valid?(items, brief: {}, user_id: 2)
    refute OutfitStructure.valid?(items, brief: {}, excluded_ids: [ 2 ])
    refute OutfitStructure.valid?(items, brief: {}, locked_ids: [ 4 ])
    refute OutfitStructure.valid?(items.drop(1), brief: {})
    refute OutfitStructure.valid?(items + [ items.first ], brief: {})
  end

  test "a bikini top alone does not provide complete body coverage" do
    refute OutfitStructure.covered?([ item(1, "swimwear", "Bikini top"), item(2, "shoes") ])
    assert OutfitStructure.covered?([ item(1, "swimwear", "One-piece swimsuit"), item(2, "shoes") ])
  end
end
