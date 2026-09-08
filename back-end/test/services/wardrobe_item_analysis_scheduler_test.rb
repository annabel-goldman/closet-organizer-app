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

  test "does not rerun a valid embedding and enrichment" do
    make_current(enriched: true)

    assert_no_enqueued_jobs do
      WardrobeItemAnalysisScheduler.call(@item.reload)
    end
  end

  test "queues missing enrichment without invalidating a valid embedding" do
    analysis = make_current(enriched: false)

    assert_enqueued_with(job: WardrobeItemAnalysisJob) do
      WardrobeItemAnalysisScheduler.call(@item.reload)
    end

    assert analysis.reload.succeeded?
    assert analysis.enrichment_pending?
    assert_equal [ 0.5, 0.5 ], analysis.embedding
  end

  private

  def make_current(enriched:)
    fingerprints = WardrobeItemFingerprint.call(@item)
    attributes = { "styles" => [ "casual" ] }
    attributes["visual"] = { "fit" => "regular" } if enriched
    (@item.wardrobe_item_analysis || @item.build_wardrobe_item_analysis).tap do |analysis|
      analysis.update!(
        status: :succeeded,
        model: OpenrouterWardrobeEmbedder::DEFAULT_MODEL,
        analysis_version: WardrobeItemAnalyzer::ANALYSIS_VERSION,
        source_fingerprint: fingerprints.fetch(:source),
        metadata_fingerprint: fingerprints.fetch(:metadata),
        embedding: [ 0.5, 0.5 ],
        extracted_attributes: attributes,
        enrichment_status: enriched ? :succeeded : :pending,
        enrichment_model: OpenrouterWardrobeEnricher::DEFAULT_MODEL,
        enrichment_version: WardrobeItemEnricher::ENRICHMENT_VERSION,
        enrichment_fingerprint: WardrobeItemEnricher.fingerprint(@item),
        enriched_at: enriched ? Time.current : nil
      )
    end
  end
end
