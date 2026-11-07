require "test_helper"

class OutfitExperimentReviewTest < ActiveSupport::TestCase
  test "never promotes without held-out human evidence" do
    experiment = OutfitExperiment.create!(user: users(:one), name: "review-test")
    assert_equal "experimental", OutfitExperimentReview.assess(experiment)[:status]
  end

  test "rejects model scores or missing human values as ratings" do
    experiment = OutfitExperiment.create!(user: users(:one), name: "review-test", manifest: { "trials" => { "dev01" => { "results" => { "contextual" => { "blind_label" => "abc" } } } } })
    assert_raises(ArgumentError) do
      OutfitExperimentReview.import!(experiment, [ { "prompt_id" => "dev01", "label" => "abc", "completeness" => 90, "request_accuracy" => 90, "wearability" => 90 } ])
    end
    assert_nil experiment.reload.manifest.dig("trials", "dev01", "results", "contextual", "ratings")
  end
end
