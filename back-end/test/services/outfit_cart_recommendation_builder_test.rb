require "test_helper"

class OutfitCartRecommendationBuilderTest < ActiveSupport::TestCase
  setup do
    @user = users(:one)
    @items = %w[top bottom shoes].to_h do |category|
      [ category, create_analyzed_item(category) ]
    end
  end

  test "returns one embedding-ranked outfit" do
    with_query_embedding do
      result = OutfitCartRecommendationBuilder.call(user: @user, prompt: "casual outfit")
      recommendation = result.fetch(:recommendation)

      assert_equal %w[bottom shoes top], recommendation.fetch(:items).map(&:category).sort
      assert_equal "test/embedding", result.dig(:models, :embedding)
      assert_equal "test/visual", result.dig(:models, :visual_selector)
      assert_equal 1, result.dig(:diagnostics, "visual_shortlist_count")
    end
  end

  test "uses the visual selection instead of always taking the highest local score" do
    alternate = create_analyzed_item("top")
    alternate.wardrobe_item_analysis.update!(embedding: [ 0.0, 1.0 ])

    with_query_embedding(selected_index: 1) do
      result = OutfitCartRecommendationBuilder.call(user: @user, prompt: "casual outfit")

      assert_includes result.dig(:recommendation, :item_ids), alternate.id
      refute_includes result.dig(:recommendation, :item_ids), @items.fetch("top").id
    end
  end

  test "keeps every item already selected in the outfit cart" do
    anchor = @items.fetch("top")
    with_query_embedding do
      result = OutfitCartRecommendationBuilder.call(
        user: @user,
        prompt: "build around my selected piece",
        locked_item_ids: [ anchor.id ]
      )

      assert_includes result.dig(:recommendation, :item_ids), anchor.id
    end
  end

  test "uses cart name tags and notes as explicit retrieval context" do
    with_query_embedding do |queries|
      OutfitCartRecommendationBuilder.call(
        user: @user,
        prompt: "Create a cohesive outfit",
        draft_metadata: {
          name: "Thanksgiving Dinner",
          tags: [ "warm", "family" ],
          notes: "Comfortable for hosting"
        }
      )

      query = queries.sole
      assert_includes query, "Outfit concept or occasion: Thanksgiving Dinner"
      assert_includes query, "Requested tags and style direction: warm, family"
      assert_includes query, "Styling notes and requirements: Comfortable for hosting"
    end
  end

  test "allows an incomplete outfit when a category is unavailable" do
    @items.fetch("shoes").wardrobe_item_analysis.destroy!
    with_query_embedding do
      result = OutfitCartRecommendationBuilder.call(user: @user, prompt: "casual outfit")

      assert_equal %w[bottom top], result.dig(:recommendation, :items).map(&:category).sort
    end
  end

  test "does not return a recently cleared outfit or a superset of it" do
    alternate = create_analyzed_item("top")
    run = @user.outfit_recommendation_runs.create!(prompt: "casual outfit", status: :succeeded)
    option = run.options.create!(
      rank: 1,
      status: :passing,
      clothing_item_ids: @items.values.map(&:id)
    )
    @user.outfit_recommendation_feedback_events.create!(
      outfit_recommendation_run: run,
      outfit_recommendation_option: option,
      event_type: "none"
    )

    with_query_embedding do
      result = OutfitCartRecommendationBuilder.call(user: @user, prompt: "casual outfit")
      selected_ids = result.dig(:recommendation, :item_ids)

      assert_includes selected_ids, alternate.id
      refute @items.values.map(&:id).all? { |id| selected_ids.include?(id) }
    end
  end

  test "filters combinations with an excessive formality gap" do
    @items.fetch("top").wardrobe_item_analysis.update!(extracted_attributes: { "visual" => { "formality" => 1 } })
    @items.fetch("bottom").wardrobe_item_analysis.update!(extracted_attributes: { "visual" => { "formality" => 4 } })
    builder = OutfitCartRecommendationBuilder.new(user: @user, prompt: "outfit", locked_item_ids: [], draft_metadata: {})

    assert builder.send(:locally_incompatible?, [ @items.fetch("top"), @items.fetch("bottom") ])
  end

  private

  def with_query_embedding(selected_index: 0)
    original = OpenrouterWardrobeEmbedder.method(:embed_query)
    original_judge = OpenrouterOutfitVisualJudge.instance_method(:call)
    queries = []
    OpenrouterWardrobeEmbedder.define_singleton_method(:embed_query) do |query|
      queries << query
      { embedding: [ 1.0, 0.0 ], model: "test/embedding", usage: {} }
    end
    OpenrouterOutfitVisualJudge.define_method(:call) do
      candidates = instance_variable_get(:@candidates)
      selected = candidates.fetch([ selected_index, candidates.length - 1 ].min)
      evaluation = {
        "candidate_id" => selected.fetch(:id).to_s,
        "overall_score" => 88,
        "title" => "Visually Selected",
        "summary" => "The strongest complete look.",
        "reasons" => [ "Selected from the visual shortlist" ]
      }
      { evaluations: [ evaluation ], passing: [ evaluation ], model: "test/visual", usage: { "cost" => 0.004 } }
    end
    yield queries
  ensure
    OpenrouterWardrobeEmbedder.define_singleton_method(:embed_query) { |*args| original.call(*args) } if original
    OpenrouterOutfitVisualJudge.define_method(:call, original_judge) if original_judge
  end

  def create_analyzed_item(category)
    item = @user.clothing_items.create!(name: category.titleize, category: category, size: :na, tags: [ "casual" ])
    item.photo.attach(
      io: File.open(Rails.root.join("test/fixtures/files/item-photo.png")),
      filename: "item-photo.png",
      content_type: "image/png"
    )
    fingerprints = WardrobeItemFingerprint.call(item)
    analysis = item.wardrobe_item_analysis || item.build_wardrobe_item_analysis
    analysis.update!(
      status: :succeeded,
      provider: "openrouter",
      model: OpenrouterWardrobeEmbedder::DEFAULT_MODEL,
      analysis_version: WardrobeItemAnalyzer::ANALYSIS_VERSION,
      source_fingerprint: fingerprints.fetch(:source),
      metadata_fingerprint: fingerprints.fetch(:metadata),
      embedding: [ 1.0, 0.0 ],
      dominant_colors: [],
      extracted_attributes: {},
      analyzed_at: Time.current
    )
    item
  end
end
