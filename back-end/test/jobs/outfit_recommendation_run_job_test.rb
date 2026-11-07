require "test_helper"

class OutfitRecommendationRunJobTest < ActiveJob::TestCase
  setup do
    @user = users(:one)
    @item = clothing_items(:one)
    @run = @user.outfit_recommendation_runs.create!(
      prompt: "Create a cohesive outfit",
      constraints: {
        "locked_item_ids" => [ @item.id ],
        "draft_metadata" => { "name" => "Thanksgiving", "tags" => [ "warm" ], "notes" => "For dinner" }
      }
    )
    @workflow = @user.ai_workflows.create!(
      subject: @run,
      kind: "outfit_recommendation",
      requested_count: 1
    )
    @workflow.initialize_stages!
  end

  test "retrieves one cart outfit without planner or visual judge stages" do
    with_fake_builder do
      OutfitRecommendationRunJob.perform_now(@workflow.id)
    end

    assert @run.reload.succeeded?
    assert @workflow.reload.succeeded?
    assert_equal [ @item.id ], @run.candidate_item_sets.sole.fetch("item_ids")
    assert_equal [ @item.id ], @run.options.passing.sole.clothing_item_ids
    assert_nil @run.result_message
    assert_equal %w[approved approved], @workflow.stages.order(:id).pluck(:status)
  end

  test "preserves the required cart anchors passed to the builder" do
    received_ids = nil
    received_metadata = nil
    with_fake_builder do
      result = fake_result
      OutfitCartRecommendationBuilder.define_singleton_method(:call) do |**args|
        received_ids = args.fetch(:locked_item_ids)
        received_metadata = args.fetch(:draft_metadata)
        result
      end
      OutfitRecommendationRunJob.perform_now(@workflow.id)
    end

    assert_equal [ @item.id ], received_ids
    assert_equal "Thanksgiving", received_metadata.fetch("name")
  end

  private

  def with_fake_builder
    original = OutfitCartRecommendationBuilder.method(:call)
    result = fake_result
    OutfitCartRecommendationBuilder.define_singleton_method(:call) { |**_args| result }
    yield
  ensure
    OutfitCartRecommendationBuilder.define_singleton_method(:call) { |**args| original.call(**args) } if original
  end

  def fake_result
    {
      brief: { "summary" => "Create a cohesive outfit" },
      models: { embedding: "test/embedding" },
      usage: { query_embedding: {} },
      recommendation: {
        id: "candidate-one",
        title: "AI Outfit",
        summary: "",
        item_ids: [ @item.id ],
        items: [ @item ],
        score: 0.8,
        reasons: []
      }
    }
  end
end
