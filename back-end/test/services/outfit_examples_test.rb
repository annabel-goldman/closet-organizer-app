require "test_helper"

class OutfitExamplesTest < ActiveSupport::TestCase
  test "near duplicate grouping includes equal and highly overlapping combinations" do
    assert OutfitExamples.near_duplicate?([ 1, 2, 3, 4 ], [ 1, 2, 3, 5 ])
    refute OutfitExamples.near_duplicate?([ 1, 2 ], [ 3, 4 ])
  end

  test "evaluation prompts are varied and frozen with one costume prompt" do
    prompts = JSON.parse(File.read(Rails.root.join("config/outfit_evaluation_prompts.json")))
    assert_equal 30, prompts.length
    assert_equal 20, prompts.count { |entry| entry["split"] == "development" }
    assert_equal 10, prompts.count { |entry| entry["split"] == "held_out" }
    assert_equal 1, prompts.count { |entry| entry["prompt"].match?(/complete .*costume/i) }
  end

  test "split is stable, disjoint, and owned by the user" do
    user = users(:one)
    experiment = OutfitExamples.experiment(user)
    assert_equal experiment.id, OutfitExamples.experiment(user).id
    manifest = experiment.manifest
    assert_empty manifest["example_outfit_ids"] & manifest["held_out_outfit_ids"]
    assert_empty (manifest["example_outfit_ids"] + manifest["held_out_outfit_ids"]) - user.outfits.pluck(:id)
    other = OutfitExamples.experiment(users(:two))
    assert_not_equal experiment.id, other.id
  end
end
