require "test_helper"

class WardrobeItemAnalysisJobTest < ActiveJob::TestCase
  setup do
    @item = users(:one).clothing_items.create!(name: "Embedding item", category: "top", size: :na)
    @item.photo.attach(
      io: File.open(Rails.root.join("test/fixtures/files/item-photo.png")),
      filename: "item-photo.png",
      content_type: "image/png"
    )
    @item.create_wardrobe_item_analysis! unless @item.wardrobe_item_analysis
  end

  test "runs the embedding analyzer without visual enrichment" do
    analyzed = false
    enriched = false
    original_analyzer = WardrobeItemAnalyzer.method(:call)
    original_enricher = WardrobeItemEnricher.method(:call)
    WardrobeItemAnalyzer.define_singleton_method(:call) { |_item| analyzed = true }
    WardrobeItemEnricher.define_singleton_method(:call) { |_item| enriched = true }

    WardrobeItemAnalysisJob.perform_now(@item.id)

    assert analyzed
    refute enriched
  ensure
    WardrobeItemAnalyzer.define_singleton_method(:call) { |item| original_analyzer.call(item) } if original_analyzer
    WardrobeItemEnricher.define_singleton_method(:call) { |item| original_enricher.call(item) } if original_enricher
  end
end
