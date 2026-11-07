require "test_helper"

class WardrobeItemAnalysisSchedulerTest < ActiveSupport::TestCase
  include ActiveJob::TestHelper

  setup do
    @item = users(:one).clothing_items.create!(name: "Current Item", category: "top", size: :na)
    @item.photo.attach(
      io: File.open(Rails.root.join("test/fixtures/files/item-photo.png")),
      filename: "item-photo.png",
      content_type: "image/png"
    )
    clear_enqueued_jobs
  end

  test "does not rerun a current embedding" do
    make_current

    assert_no_enqueued_jobs do
      WardrobeItemAnalysisScheduler.call(@item.reload)
    end
  end

  test "does not require visual enrichment when the embedding is current" do
    analysis = make_current
    analysis.update!(enrichment_status: :pending, extracted_attributes: {})

    assert_no_enqueued_jobs do
      WardrobeItemAnalysisScheduler.call(@item.reload)
    end
  end

  private

  def make_current
    fingerprints = WardrobeItemFingerprint.call(@item)
    (@item.wardrobe_item_analysis || @item.build_wardrobe_item_analysis).tap do |analysis|
      analysis.update!(
        status: :succeeded,
        model: OpenrouterWardrobeEmbedder::DEFAULT_MODEL,
        analysis_version: WardrobeItemAnalyzer::ANALYSIS_VERSION,
        source_fingerprint: fingerprints.fetch(:source),
        metadata_fingerprint: fingerprints.fetch(:metadata),
        embedding: [ 0.5, 0.5 ],
        extracted_attributes: {}
      )
    end
  end
end
