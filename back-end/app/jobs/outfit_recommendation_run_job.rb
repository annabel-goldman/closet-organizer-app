class OutfitRecommendationRunJob < ApplicationJob
  queue_as :ai

  def perform(workflow_id, start_at: nil)
    workflow = AiWorkflow.includes(:stages, :user).find(workflow_id)
    return if ai_workflow_terminal?(workflow)

    run = workflow.subject
    raise "This workflow is not attached to an outfit recommendation run." unless run.is_a?(OutfitRecommendationRun)

    workflow.mark_processing!
    run.update!(status: :processing, error_message: nil, completed_at: nil)
    skip_retired_stages(workflow)

    OutfitProviderBudget.with(run: run) do
      retrieve_outfit(run, workflow)
      return if ai_workflow_cancelled_after_reload?(workflow)

      finalize_run(run, workflow)
    end
  rescue StandardError => error
    run&.update(status: :failed, error_message: error.message, completed_at: Time.current)
    fail_ai_workflow!(workflow, error, context: "Outfit recommendation workflow #{workflow_id}")
  end

  private

  def retrieve_outfit(run, workflow)
    stage = workflow.stage("retrieve")
    stage.processing!
    result = OutfitCartRecommendationBuilder.call(
      user: run.user,
      prompt: run.prompt,
      locked_item_ids: run.constraints.fetch("locked_item_ids", []),
      draft_metadata: run.constraints.fetch("draft_metadata", {})
    )
    recommendation = result.fetch(:recommendation)
    run.options.delete_all
    run.options.create!(
      rank: 1,
      status: :passing,
      title: recommendation.fetch(:title),
      summary: recommendation.fetch(:summary),
      clothing_item_ids: recommendation.fetch(:item_ids),
      local_score: recommendation.fetch(:score),
      judge_score: recommendation.fetch(:score) * 100,
      reasons: recommendation.fetch(:reasons)
    )
    run.update!(
      structured_brief: result.fetch(:brief),
      candidate_item_sets: [ { "id" => recommendation.fetch(:id), "item_ids" => recommendation.fetch(:item_ids) } ],
      models: run.models.merge(result.fetch(:models).stringify_keys),
      usage: run.usage.merge(result.fetch(:usage).stringify_keys)
    )
    stage.update!(diagnostics: result.fetch(:diagnostics, {}).merge("item_count" => recommendation.fetch(:item_ids).length))
    stage.auto_approve!
  end

  def finalize_run(run, workflow)
    stage = workflow.stage("finalize")
    stage.processing!
    raise "The outfit builder did not return a result." unless run.options.reload.any?(&:passing?)
    run.update!(status: :succeeded, result_message: nil, error_message: nil, completed_at: Time.current)
    stage.update!(diagnostics: { "returned_count" => 1 })
    stage.auto_approve!
    workflow.update!(completed_count: 1)
    workflow.mark_succeeded!
  end

  def skip_retired_stages(workflow)
    workflow.stages.where(key: %w[plan judge], status: %w[pending processing]).update_all(
      status: "skipped",
      completed_at: Time.current
    )
  end
end
