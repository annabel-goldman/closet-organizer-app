require "test_helper"

class WardrobeItemAnalysisJobTest < ActiveJob::TestCase
  setup do
    @item = users(:one).clothing_items.create!(name: "Broken embedding item", category: "top", size: :na)
    @item.photo.attach(
      io: File.open(Rails.root.join("test/fixtures/files/item-photo.png")),
      filename: "item-photo.png",
      content_type: "image/png"
    )
    @item.create_wardrobe_item_analysis! unless @item.wardrobe_item_analysis
  end

  test "an embedding failure leaves enrichment retryable instead of permanently pending" do
    original_analyzer = WardrobeItemAnalyzer.method(:call)
    WardrobeItemAnalyzer.define_singleton_method(:call) { |_item| raise "embedding unavailable" }

    WardrobeItemAnalysisJob.perform_now(@item.id)

    analysis = @item.wardrobe_item_analysis.reload
    assert analysis.enrichment_failed?
    assert_match(/Retry this item/, analysis.enrichment_error_message)
  ensure
    WardrobeItemAnalyzer.define_singleton_method(:call) { |item| original_analyzer.call(item) } if original_analyzer
  end
end
