require "test_helper"

class OutfitTargetedRepairTest < ActiveSupport::TestCase
  test "keeps the original when a repair is worse or tied but does not gate on model warnings" do
    winner = { "candidate_id" => "original", "overall_score" => 50, "hard_violations" => [] }
    repair = winner.merge("candidate_id" => "repair", "overall_score" => 49)
    assert_equal winner, OpenrouterOutfitVisualJudge.highest_ranked([ winner, repair ])
    assert_equal winner, OpenrouterOutfitVisualJudge.highest_ranked([ winner, repair.merge("overall_score" => 50) ])
    repair = repair.merge("overall_score" => 90, "hard_violations" => [ "missing suggested prop" ])
    assert_equal repair, OpenrouterOutfitVisualJudge.highest_ranked([ winner, repair ])
    assert_equal 94, OpenrouterOutfitVisualJudge.highest_ranked([ winner.merge("overall_score" => 94), repair ])["overall_score"]
  end

  test "never repairs a locked garment or invents a target" do
    assert_nil OutfitTargetedRepair.call(brief: {}, candidate: { items: [] }, evaluation: { "repair_item_id" => 1, "repair_instruction" => "change color" }, pools: {}, locked_ids: [ 1 ], excluded_ids: [], user_id: 1)
    assert_nil OutfitTargetedRepair.call(brief: {}, candidate: { items: [] }, evaluation: { "repair_item_id" => 999, "repair_instruction" => "change color" }, pools: {}, locked_ids: [], excluded_ids: [], user_id: 1)
  end
end
