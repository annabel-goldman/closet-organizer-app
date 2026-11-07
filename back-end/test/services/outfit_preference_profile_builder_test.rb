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

  test "saving an AI recommendation teaches taste without double counting its exact pairing" do
    user = users(:one)
    top = analyzed_item(user, "Accepted Top")
    bottom = analyzed_item(user, "Accepted Bottom", category: "bottom")
    manual_outfit_count = user.outfits.count
    outfit = user.outfits.create!(name: "Accepted recommendation", clothing_items: [ top, bottom ])
    run = user.outfit_recommendation_runs.create!(prompt: "casual outfit", status: :succeeded)
    option = run.options.create!(
      rank: 1,
      status: :passing,
      clothing_item_ids: [ top.id, bottom.id ],
      outfit: outfit
    )
    user.outfit_recommendation_feedback_events.create!(
      outfit_recommendation_run: run,
      outfit_recommendation_option: option,
      event_type: "save"
    )

    profile = OutfitPreferenceProfileBuilder.call(user, refresh: true)
    item_score = profile.fetch("item_scores").fetch(top.id.to_s)
    pair_score = profile.fetch("pair_scores").fetch([ top.id, bottom.id ].sort.join(":"))

    assert_in_delta 2.0, item_score, 0.01
    assert_in_delta 0.3, pair_score, 0.01
    assert_operator pair_score, :<, item_score
    assert_equal manual_outfit_count, profile.fetch("source_outfit_count")
  end

  private

  def analyzed_item(user, name, category: "top")
    item = user.clothing_items.create!(name: name, category: category, size: :na)
    item.create_wardrobe_item_analysis!(
      status: :succeeded,
      embedding: [ 1.0, 0.0 ],
      dominant_colors: [],
      extracted_attributes: { "formality" => 2 }
    )
    item
  end
end
