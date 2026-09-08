require "test_helper"

class OutfitPreferenceProfileBuilderTest < ActiveSupport::TestCase
  test "later keep and exclude feedback changes ranking without exceeding the personalization cap" do
    user = users(:one)
    kept = analyzed_item(user, "Kept Top")
    excluded = analyzed_item(user, "Excluded Top")
    run = user.outfit_recommendation_runs.create!(prompt: "casual top")
    OutfitRecommendationFeedbackRecorder.call(user: user, run: run, event_type: "keep", clothing_item: kept)
    OutfitRecommendationFeedbackRecorder.call(user: user, run: run, event_type: "exclude", clothing_item: excluded)
    profile = OutfitPreferenceProfileBuilder.call(user)
    scorer = OutfitRecommendationScorer.new(
      brief: {
        "preferred_colors" => [], "excluded_colors" => [], "style_terms" => [],
        "material_terms" => [], "seasons" => [], "formality" => 2
      },
      query_embedding: [ 1.0, 0.0 ],
      preference_profile: profile
    )

    assert_operator scorer.item_score(kept), :>, scorer.item_score(excluded)
    assert_operator (scorer.item_score(kept) - scorer.item_score(excluded)), :<=, OutfitRecommendationScorer::MAX_PERSONALIZATION
  end

  private

  def analyzed_item(user, name)
    item = user.clothing_items.create!(name: name, category: "top", size: :na)
    item.create_wardrobe_item_analysis!(
      status: :succeeded,
      embedding: [ 1.0, 0.0 ],
      dominant_colors: [],
      extracted_attributes: { "formality" => 2 }
    )
    item
  end
end
