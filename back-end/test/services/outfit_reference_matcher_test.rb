require "test_helper"

class OutfitReferenceMatcherTest < ActiveSupport::TestCase
  setup do
    @user = users(:one)
  end

  test "ranks closet items by required visual slot matches" do
    hoodie = create_item(
      name: "Olive Wing Graphic Hoodie",
      category: "top",
      tags: %w[olive hoodie wing graphic]
    )
    raincoat = create_item(
      name: "Tan Hooded Rain Jacket",
      category: "top",
      tags: %w[tan hooded jacket]
    )
    bag = create_item(
      name: "Silver Chain Shoulder Bag",
      category: "bag",
      tags: %w[silver chain shoulder purse]
    )

    matcher = OutfitReferenceMatcher.new(reference_profile)

    assert_equal hoodie.id, matcher.ranked_items_for_slot([ raincoat, hoodie ], reference_profile["target_slots"].first).first[:item].id
    assert_includes matcher.best_candidate_ids_by_slot([ raincoat, hoodie, bag ], limit_per_slot: 1), hoodie.id
    assert_includes matcher.best_candidate_ids_by_slot([ raincoat, hoodie, bag ], limit_per_slot: 1), bag.id
  end

  test "repairs a selection by adding a missing required bag" do
    hoodie = create_item(name: "Olive Wing Graphic Hoodie", category: "top", tags: %w[olive hoodie wing])
    shorts = create_item(name: "White Denim Distressed Shorts", category: "bottom", tags: %w[white denim shorts distressed])
    bag = create_item(name: "Silver Chain Shoulder Bag", category: "bag", tags: %w[silver chain shoulder purse])

    matcher = OutfitReferenceMatcher.new(reference_profile)
    repaired_ids = matcher.repair_selection([ hoodie.id, shorts.id ], [ hoodie, shorts, bag ], max_items: 6)

    assert_includes repaired_ids, bag.id
  end

  test "uses a weak bottom match instead of leaving a required bottom slot empty" do
    hoodie = create_item(name: "Olive Wing Graphic Hoodie", category: "top", tags: %w[olive hoodie wing])
    lounge_shorts = create_item(name: "Cream Lounge Shorts", category: "bottom", tags: %w[cream soft shorts])

    matcher = OutfitReferenceMatcher.new({
      "overall_style" => [ "casual glam" ],
      "target_slots" => [
        {
          "role" => "bottom",
          "required" => true,
          "subtype" => "white distressed denim shorts",
          "colors" => [ "white" ],
          "materials" => [ "denim" ],
          "visual_features" => [ "distressed hem", "cutoff" ],
          "weight" => 0.9
        }
      ]
    })

    repaired_ids = matcher.repair_selection([ hoodie.id ], [ hoodie, lounge_shorts ], max_items: 6)

    assert_includes repaired_ids, lounge_shorts.id
  end

  test "does not force a weak accessory match just because the reference has one" do
    hoodie = create_item(name: "Olive Wing Graphic Hoodie", category: "top", tags: %w[olive hoodie wing])
    random_bag = create_item(name: "Brown Leather Tote", category: "bag", tags: %w[brown leather tote])

    matcher = OutfitReferenceMatcher.new({
      "overall_style" => [ "casual glam" ],
      "target_slots" => [
        {
          "role" => "bag",
          "required" => true,
          "subtype" => "silver chain shoulder bag",
          "colors" => [ "silver" ],
          "materials" => [ "metallic" ],
          "visual_features" => [ "chain strap" ],
          "weight" => 0.9
        }
      ]
    })

    repaired_ids = matcher.repair_selection([ hoodie.id ], [ hoodie, random_bag ], max_items: 6)

    assert_not_includes repaired_ids, random_bag.id
  end

  test "keeps cross-slot signature vibe anchors such as sequins and burgundy leather" do
    sequin_top = create_item(name: "Beige Sequin Halter Top", category: "top", tags: %w[beige sequin halter glam])
    white_skirt = create_item(name: "White Mini Skirt with Flap Pockets", category: "bottom", tags: %w[white mini skirt pockets])
    burgundy_bag = create_item(name: "Burgundy Embossed Leather Shoulder Bag", category: "bag", tags: %w[burgundy embossed leather shoulder bag])
    red_mary_janes = create_item(name: "Red Double-Strap Mary Janes", category: "shoes", tags: %w[red burgundy mary janes polished])
    plain_shorts = create_item(name: "Cream Denim Cutoff Shorts", category: "bottom", tags: %w[cream denim shorts])

    matcher = OutfitReferenceMatcher.new(glam_reference_profile)
    signature_ids = matcher.best_signature_candidate_ids(
      [ sequin_top, white_skirt, burgundy_bag, red_mary_janes, plain_shorts ],
      limit: 4
    )

    assert_includes signature_ids, sequin_top.id
    assert_includes signature_ids, burgundy_bag.id
    assert_includes signature_ids, red_mary_janes.id
  end

  test "upgrades an already-present bottom when a stronger palette match exists" do
    top = create_item(name: "Pink Sequin Camisole", category: "top", tags: %w[pink sequin camisole])
    blue_skirt = create_item(name: "Denim Blue Mini Skirt", category: "bottom", tags: %w[denim blue mini skirt])
    white_skirt = create_item(
      name: "White Mini Skirt with Flap Pockets",
      category: "bottom",
      tags: %w[white cream mini skirt flap pockets]
    )

    matcher = OutfitReferenceMatcher.new({
      "overall_style" => [ "pink cream gray glam" ],
      "target_slots" => [
        {
          "role" => "bottom",
          "required" => true,
          "subtype" => "cream graphic mini skirt",
          "colors" => [ "cream", "white", "pink" ],
          "materials" => [ "structured cotton" ],
          "visual_features" => [ "mini length", "flap pockets" ],
          "weight" => 0.9
        }
      ]
    })

    repaired_ids = matcher.repair_selection(
      [ top.id, blue_skirt.id ],
      [ top, blue_skirt, white_skirt ],
      max_items: 6
    )

    assert_includes repaired_ids, white_skirt.id
    assert_not_includes repaired_ids, blue_skirt.id
  end

  test "upgrades an already-present top when a stronger pink camisole match exists" do
    beige_halter = create_item(name: "Beige Sequin Halter Top", category: "top", tags: %w[beige sequin halter glam])
    pink_camisole = create_item(name: "Pink Sequin Camisole", category: "top", tags: %w[pink sequin camisole])
    skirt = create_item(name: "White Mini Skirt with Flap Pockets", category: "bottom", tags: %w[white mini skirt])

    matcher = OutfitReferenceMatcher.new({
      "overall_style" => [ "pink cream glam" ],
      "target_slots" => [
        {
          "role" => "top",
          "required" => true,
          "subtype" => "pink satin camisole",
          "colors" => [ "pink", "blush" ],
          "materials" => [ "satin" ],
          "visual_features" => [ "thin straps", "soft shine" ],
          "weight" => 0.9
        }
      ]
    })

    repaired_ids = matcher.repair_selection(
      [ beige_halter.id, skirt.id ],
      [ beige_halter, pink_camisole, skirt ],
      max_items: 6
    )

    assert_includes repaired_ids, pink_camisole.id
    assert_not_includes repaired_ids, beige_halter.id
  end

  test "uses user preference context as a gentle scoring nudge" do
    plain_bag = create_item(name: "Brown Leather Shoulder Bag", category: "bag", tags: %w[brown leather shoulder bag])
    textured_bag = create_item(name: "Beige Textured Chain Strap Bag", category: "bag", tags: %w[beige textured chain strap bag])

    matcher = OutfitReferenceMatcher.new(
      {
        "overall_style" => [ "soft glam" ],
        "target_slots" => [
          {
            "role" => "bag",
            "required" => true,
            "subtype" => "shoulder bag",
            "colors" => [ "beige" ],
            "materials" => [ "textured" ],
            "visual_features" => [ "chain strap" ],
            "weight" => 0.8
          }
        ]
      },
      preference_context: {
        "preferred_item_ids" => [ textured_bag.id ],
        "preferred_terms" => %w[textured chain]
      }
    )

    assert_equal textured_bag.id, matcher.ranked_items_for_slot([ plain_bag, textured_bag ], matcher.target_slots.first).first[:item].id
  end

  private

  def create_item(name:, category:, tags:)
    ClothingItem.create!(
      user: @user,
      name: name,
      category: category,
      tags: tags,
      size: :na
    )
  end

  def reference_profile
    {
      "overall_style" => [ "casual glam" ],
      "target_slots" => [
        {
          "role" => "top",
          "required" => true,
          "subtype" => "hoodie",
          "colors" => [ "olive" ],
          "materials" => [ "sweatshirt fleece" ],
          "visual_features" => [ "wing graphic" ],
          "weight" => 0.95
        },
        {
          "role" => "bag",
          "required" => true,
          "subtype" => "chain shoulder bag",
          "colors" => [ "silver" ],
          "materials" => [ "metallic" ],
          "visual_features" => [ "chain strap" ],
          "weight" => 0.9
        }
      ]
    }
  end

  def glam_reference_profile
    {
      "overall_style" => [ "burgundy cream glam", "sparkly evening" ],
      "target_slots" => [
        {
          "role" => "top",
          "required" => true,
          "subtype" => "satin camisole",
          "colors" => [ "white", "cream" ],
          "materials" => [ "satin" ],
          "visual_features" => [ "thin straps", "bow tie" ],
          "weight" => 0.8
        },
        {
          "role" => "bottom",
          "required" => true,
          "subtype" => "sequined shorts",
          "colors" => [ "burgundy" ],
          "materials" => [ "sequins" ],
          "visual_features" => [ "sparkly", "micro shorts" ],
          "weight" => 0.9
        },
        {
          "role" => "bag",
          "required" => true,
          "subtype" => "structured shoulder bag",
          "colors" => [ "burgundy" ],
          "materials" => [ "croc leather", "patent leather" ],
          "visual_features" => [ "glossy", "structured" ],
          "weight" => 0.85
        },
        {
          "role" => "shoes",
          "required" => true,
          "subtype" => "knee high boots",
          "colors" => [ "burgundy" ],
          "materials" => [ "patent leather" ],
          "visual_features" => [ "glossy" ],
          "weight" => 0.8
        }
      ]
    }
  end
end
