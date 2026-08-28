require "test_helper"

class AiWorkflowTest < ActiveSupport::TestCase
  test "initializes the stages for an outfit upload workflow" do
    workflow = users(:one).ai_workflows.create!(kind: "outfit_upload")

    workflow.initialize_stages!

    assert_equal %w[detect crop], workflow.stages.order(:id).pluck(:key)
    assert_equal %w[pending pending], workflow.stages.order(:id).pluck(:status)
  end

  test "tracks review and failure state without losing the workflow" do
    workflow = users(:one).ai_workflows.create!(kind: "item_clean")
    workflow.initialize_stages!

    workflow.mark_processing!
    workflow.stage("clean").processing!
    workflow.stage("clean").review!
    workflow.mark_review!

    assert workflow.review?
    assert_equal "review", workflow.stage("clean").status
    assert_equal 1, workflow.stage("clean").attempts

    workflow.mark_failed!("provider unavailable")

    assert workflow.failed?
    assert_equal 1, workflow.failed_count
    assert_equal "provider unavailable", workflow.error_message
  end

  test "rejects a workflow with an unsupported kind" do
    workflow = users(:one).ai_workflows.new(kind: "unsupported")

    assert_not workflow.valid?
    assert_includes workflow.errors[:kind], "is not included in the list"
  end
end
