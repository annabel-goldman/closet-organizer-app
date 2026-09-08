require "test_helper"

class OpenrouterOutfitBriefParserTest < ActiveSupport::TestCase
  test "schema captures contextual composition and hard constraints" do
    schema = OpenrouterOutfitBriefParser.new("fall dinner").send(:response_schema)

    assert_includes schema.fetch(:required), "preferred_colors"
    assert_includes schema.fetch(:required), "anchor"
    assert_includes schema.fetch(:required), "garment_roles"
    assert_includes schema.fetch(:required), "silhouette_strategy"
    assert_includes schema.fetch(:required), "hard_constraints"
    assert_equal OpenrouterOutfitBriefParser::CATEGORIES, schema.dig(:properties, :anchor, :properties, :category, :enum)
  end

  test "normalizes categories and exact color names" do
    result = OpenrouterOutfitBriefParser.new("fall dinner").send(:normalize, {
      "summary" => "  Warm fall dinner look ",
      "anchor" => { "category" => "top", "description" => "fitted burgundy knit" },
      "garment_roles" => [
        { "name" => "anchor top", "category" => "top", "required" => true, "layer" => 1, "description" => "fitted" },
        { "name" => "bottom", "category" => "bottom", "required" => true, "layer" => 1, "description" => "relaxed" },
        { "name" => "shoes", "category" => "shoes", "required" => true, "layer" => 2, "description" => "walkable" },
        { "name" => "jacket", "category" => "outerwear", "required" => false, "layer" => 3, "description" => "warm" }
      ],
      "preferred_colors" => %w[burgundy brown chartreuse],
      "excluded_colors" => [ "orange" ],
      "style_terms" => [ "Y2K" ],
      "material_terms" => [ "Corduroy" ],
      "seasons" => [ "fall" ],
      "formality" => 2,
      "layering_strategy" => "light layer",
      "silhouette_strategy" => "fitted over relaxed",
      "palette_strategy" => "warm analogous",
      "pattern_strategy" => "one pattern",
      "texture_strategy" => "soft contrast",
      "weather" => "cool",
      "occasion" => "dinner",
      "hard_constraints" => [ "no orange" ],
      "soft_constraints" => [ "y2k" ]
    })

    assert_equal %w[top bottom shoes], result["required_categories"]
    assert_equal [ "outerwear" ], result["optional_categories"]
    assert_equal %w[burgundy brown chartreuse], result["preferred_colors"]
    assert_equal [ "y2k" ], result["style_terms"]
  end
end
