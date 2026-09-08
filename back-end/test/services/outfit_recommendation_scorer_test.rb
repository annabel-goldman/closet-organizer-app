require "test_helper"

class OutfitRecommendationScorerTest < ActiveSupport::TestCase
  FakeAnalysis = Data.define(:embedding, :dominant_colors, :extracted_attributes)
  FakeItem = Data.define(:category, :wardrobe_item_analysis)

  test "exact requested shades outrank unrelated colors" do
    scorer = OutfitRecommendationScorer.new(
      brief: {
        "preferred_colors" => [ "burgundy" ],
        "excluded_colors" => [],
        "style_terms" => [ "y2k" ],
        "material_terms" => [],
        "seasons" => [ "fall" ],
        "formality" => 2
      },
      query_embedding: [ 1.0, 0.0 ]
    )
    burgundy = fake_item([ 105, 28, 48 ])
    blue = fake_item([ 40, 95, 190 ])

    assert_operator scorer.item_score(burgundy), :>, scorer.item_score(blue)
  end

  private

  def fake_item(rgb)
    analysis = FakeAnalysis.new(
      [ 1.0, 0.0 ],
      [ { "lab" => ColorScience.rgb_to_lab(rgb) } ],
      { "styles" => [ "y2k" ], "materials" => [], "patterns" => [], "seasons" => [ "fall" ], "formality" => 2 }
    )
    FakeItem.new("top", analysis)
  end
end
