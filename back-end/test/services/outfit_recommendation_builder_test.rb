require "test_helper"

class OutfitRecommendationBuilderTest < ActiveSupport::TestCase
  include ActiveJob::TestHelper

  setup do
    clear_enqueued_jobs
    @items = %w[top bottom shoes].flat_map do |category|
      2.times.map { |index| create_analyzed_item(category, index) }
    end
  end

  test "builds three complete and varied closet-only options" do
    brief = {
      "summary" => "A warm fall look",
      "structure" => "separates",
      "required_categories" => %w[top bottom shoes],
      "optional_categories" => [],
      "preferred_colors" => [ "brown" ],
      "excluded_colors" => [],
      "style_terms" => [ "casual" ],
      "material_terms" => [],
      "seasons" => [ "fall" ],
      "formality" => 2,
      "option_titles" => [ "Cider Walk", "Orchard Day", "Autumn Weekend" ]
    }
    original_parser = OpenrouterOutfitBriefParser.method(:call)
    original_embedder = OpenrouterWardrobeEmbedder.method(:embed_query)
    OpenrouterOutfitBriefParser.define_singleton_method(:call) { |_prompt| brief }
    OpenrouterWardrobeEmbedder.define_singleton_method(:embed_query) do |_prompt|
      { embedding: [ 1.0, 0.0 ], provider: "openrouter", model: OpenrouterWardrobeEmbedder::DEFAULT_MODEL, usage: {} }
    end

    result = OutfitRecommendationBuilder.call(user: users(:one), prompt: "fall weekend", shortlist_count: 3)

    assert_equal 3, result.fetch(:recommendations).length
    result.fetch(:recommendations).each do |recommendation|
      assert_equal %w[bottom shoes top], recommendation.fetch(:items).map(&:category).sort
      assert recommendation.fetch(:items).all? { |item| item.user_id == users(:one).id }
    end
    assert_equal 3, result.fetch(:recommendations).map { |recommendation| recommendation.fetch(:item_ids).sort }.uniq.length
  ensure
    OpenrouterOutfitBriefParser.define_singleton_method(:call) { |*args| original_parser.call(*args) } if original_parser
    OpenrouterWardrobeEmbedder.define_singleton_method(:embed_query) { |*args| original_embedder.call(*args) } if original_embedder
  end

  test "missing planned dress falls back to complete separates with an honest compromise" do
    original = OpenrouterWardrobeEmbedder.method(:embed_query)
    queries = []
    OpenrouterWardrobeEmbedder.define_singleton_method(:embed_query) do |query|
      queries << query
      { embedding: [ 1.0, 0.0 ], model: OpenrouterWardrobeEmbedder::DEFAULT_MODEL, usage: {} }
    end
    result = OutfitRecommendationBuilder.call(user: users(:one), prompt: "a dress for dinner", brief: {
      "anchor" => { "category" => "dress", "description" => "evening dress" }, "formality" => 3
    }, excluded_item_ids: [ @items.first.id ], shortlist_count: 2)
    assert_equal 2, result[:recommendations].length
    assert_equal "separates", result[:brief]["structure"]
    assert_match(/No available dress/, result[:brief]["compromises"].join)
    result[:recommendations].each do |outfit|
      assert_equal %w[bottom shoes top], outfit[:items].map(&:category).sort
      refute_includes outfit[:item_ids], @items.first.id
    end
    assert queries.any? { |query| query.include?("top") }
    assert queries.any? { |query| query.include?("bottom") }
    assert queries.any? { |query| query.include?("shoes") }
  ensure
    OpenrouterWardrobeEmbedder.define_singleton_method(:embed_query) { |*args| original.call(*args) } if original
  end

  test "contradictory kept and excluded pieces are not silently relaxed" do
    assert_raises(RuntimeError) do
      OutfitRecommendationBuilder.call(user: users(:one), prompt: "anything", locked_item_ids: [ @items.first.id ], excluded_item_ids: [ @items.first.id ])
    end
  end

  test "missing bottom and footwear no longer prevent returning an available top" do
    original = OpenrouterWardrobeEmbedder.method(:embed_query)
    OpenrouterWardrobeEmbedder.define_singleton_method(:embed_query) do |_query|
      { embedding: [ 1.0, 0.0 ], model: OpenrouterWardrobeEmbedder::DEFAULT_MODEL, usage: {} }
    end
    excluded = @items.reject { |item| item.category == "top" }.map(&:id)
    result = OutfitRecommendationBuilder.call(user: users(:one), prompt: "casual outfit", excluded_item_ids: excluded, brief: {}, shortlist_count: 2)
    assert result[:recommendations].any?
    result[:recommendations].each do |outfit|
      assert_equal [ "top" ], outfit[:items].map(&:category)
      assert_empty outfit[:item_ids] & excluded
    end
  ensure
    OpenrouterWardrobeEmbedder.define_singleton_method(:embed_query) { |*args| original.call(*args) } if original
  end

  test "inferred accessories do not crowd the simple base look out of the shortlist" do
    create_analyzed_item("accessory", 0)
    original = OpenrouterWardrobeEmbedder.method(:embed_query)
    OpenrouterWardrobeEmbedder.define_singleton_method(:embed_query) do |_query|
      { embedding: [ 1.0, 0.0 ], model: OpenrouterWardrobeEmbedder::DEFAULT_MODEL, usage: {} }
    end
    brief = { "garment_roles" => %w[top bottom shoes accessory].map { |category| OutfitStructure.role(category) } }
    result = OutfitRecommendationBuilder.call(user: users(:one), prompt: "party look", brief: brief, shortlist_count: 3)
    assert result[:recommendations].any? { |outfit| outfit[:items].none? { |item| item.category == "accessory" } }
  ensure
    OpenrouterWardrobeEmbedder.define_singleton_method(:embed_query) { |*args| original.call(*args) } if original
  end

  private


  def create_analyzed_item(category, index)
    item = users(:one).clothing_items.create!(
      category: category,
      name: "#{category.titleize} #{index + 1}",
      size: :na,
      tags: %w[brown casual fall]
    )
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
      embedding: [ 1.0 - (index * 0.1), index * 0.1 ],
      dominant_colors: [ { "lab" => WardrobeColorLexicon.lab_for("brown"), "proportion" => 1.0 } ],
      extracted_attributes: {
        "styles" => [ "casual" ], "materials" => [], "patterns" => [], "seasons" => [ "fall" ], "formality" => 2
      },
      analyzed_at: Time.current
    )
    item
  end
end
