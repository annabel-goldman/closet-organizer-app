require "test_helper"

class OutfitRecommendationRunJobTest < ActiveJob::TestCase
  setup do
    @user = users(:one)
    @item = clothing_items(:one)
    @run = @user.outfit_recommendation_runs.create!(prompt: "A polished fall dinner look")
    @workflow = @user.ai_workflows.create!(
      subject: @run,
      kind: "outfit_recommendation",
      requested_count: 12
    )
    @workflow.initialize_stages!
  end

  test "persists the shortlist and returns only judged passing options" do
    with_fake_pipeline do
      OutfitRecommendationRunJob.perform_now(@workflow.id)
    end

    assert @run.reload.succeeded?
    assert @workflow.reload.succeeded?
    assert_equal [ @item.id ], @run.candidate_item_sets.first.fetch("item_ids")
    assert_equal 1, @run.options.passing.count
    assert_equal 86, @run.options.first.judge_score.to_i
    assert_equal %w[approved approved approved approved], @workflow.stages.order(:id).pluck(:status)
  end

  test "preserves candidates when visual judging fails" do
    original_judge = OpenrouterOutfitVisualJudge.method(:call)
    with_fake_pipeline(judge: false) do
      OpenrouterOutfitVisualJudge.define_singleton_method(:call) { |**_args| raise "judge unavailable" }
      OutfitRecommendationRunJob.perform_now(@workflow.id)
    end

    assert @run.reload.failed?
    assert_equal [ @item.id ], @run.candidate_item_sets.first.fetch("item_ids")
    assert_equal 1, @run.options.candidate.count
    assert_equal "judge unavailable", @run.error_message
  ensure
    OpenrouterOutfitVisualJudge.define_singleton_method(:call) { |**args| original_judge.call(**args) } if original_judge
  end

  private

  def with_fake_pipeline(judge: true)
    original_parser = OpenrouterOutfitBriefParser.method(:call)
    original_builder = OutfitRecommendationBuilder.method(:call)
    original_judge = OpenrouterOutfitVisualJudge.method(:call)
    OpenrouterOutfitBriefParser.define_singleton_method(:call) do |*_args, **_kwargs|
      {
        "summary" => "Polished fall dinner",
        "anchor" => { "category" => "top", "description" => "ivory blouse" },
        "garment_roles" => [ { "name" => "top", "category" => "top", "required" => true, "layer" => 1, "description" => "polished" } ],
        "required_categories" => [ "top" ], "optional_categories" => [],
        "preferred_colors" => [ "ivory" ], "excluded_colors" => [],
        "style_terms" => [ "elegant" ], "material_terms" => [ "silk" ], "seasons" => [ "fall" ],
        "formality" => 4, "model" => "test/planner", "usage" => { "prompt_tokens" => 10 }
      }
    end
    item = @item
    OpenrouterOutfitVisualJudge.define_singleton_method(:call) do |**_args|
      {
        evaluations: [ {
          "candidate_id" => "candidate-one",
          "scores" => { "prompt_accuracy" => 90 },
          "overall_score" => 86,
          "title" => "Ivory Evening",
          "summary" => "A cohesive dinner look",
          "reasons" => [ "Polished and balanced" ],
          "hard_violations" => []
        } ],
        passing: [ { "candidate_id" => "candidate-one", "overall_score" => 86 } ],
        model: "test/judge", usage: { "cost" => 0.004 }, quality_floor: 70
      }
    end if judge
    OutfitRecommendationBuilder.define_singleton_method(:call) do |**_args|
      {
        models: { planner: "test/planner", embedding: "test/embedding" }, usage: {},
        recommendations: [ {
          id: "candidate-one", title: "Candidate", summary: "Polished fall dinner",
          item_ids: [ item.id ], items: [ item ], score: 0.8, reasons: [ "Strong match" ]
        } ]
      }
    end
    yield
  ensure
    OpenrouterOutfitBriefParser.define_singleton_method(:call) { |*args, **kwargs| original_parser.call(*args, **kwargs) } if original_parser
    OutfitRecommendationBuilder.define_singleton_method(:call) { |**args| original_builder.call(**args) } if original_builder
    OpenrouterOutfitVisualJudge.define_singleton_method(:call) { |**args| original_judge.call(**args) } if original_judge && judge
  end
end
