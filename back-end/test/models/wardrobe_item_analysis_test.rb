require "test_helper"

class WardrobeItemAnalysisTest < ActiveSupport::TestCase
  test "treats OpenRouter's resolved model name as the configured model" do
    analysis = WardrobeItemAnalysis.new(
      status: :succeeded,
      model: "gemini-embedding-2",
      source_fingerprint: "source",
      metadata_fingerprint: "metadata",
      analysis_version: "wardrobe-item-v1",
      embedding: [ 0.5 ]
    )

    assert analysis.ready_for?(
      source_fingerprint: "source",
      metadata_fingerprint: "metadata",
      model: "google/gemini-embedding-2",
      analysis_version: "wardrobe-item-v1"
    )
  end

  test "does not treat a different embedding model as ready" do
    analysis = WardrobeItemAnalysis.new(
      status: :succeeded,
      model: "different-embedding-model",
      source_fingerprint: "source",
      metadata_fingerprint: "metadata",
      analysis_version: "wardrobe-item-v1",
      embedding: [ 0.5 ]
    )

    assert_not analysis.ready_for?(
      source_fingerprint: "source",
      metadata_fingerprint: "metadata",
      model: "google/gemini-embedding-2",
      analysis_version: "wardrobe-item-v1"
    )
  end
end
