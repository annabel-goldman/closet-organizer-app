class WardrobeAnalysisBackfillJob < ApplicationJob
  queue_as :ai

  def perform(workflow_id)
    workflow = AiWorkflow.includes(:stages).find(workflow_id)
    return if ai_workflow_terminal?(workflow)

    workflow.mark_processing!

    items = workflow.user.clothing_items.with_attached_photo.with_attached_cleaned_photo.includes(
      :wardrobe_item_analysis,
      image_versions: { image_attachment: :blob }
    ).order(:id).to_a
    workflow.update!(requested_count: items.length, completed_count: 0, failed_count: 0)

    embed_stage = workflow.stage("embed")
    embed_stage.processing!
    failure_ids = []
    items.each do |item|
      break if workflow.reload.cancelled?

      failure_ids << item.id unless embed_item(item)
    end
    return if workflow.reload.cancelled?
    succeeded = current_embedding_count(items)
    embed_stage.update!(diagnostics: { "ready_count" => succeeded, "failed_count" => failure_ids.length })
    embed_stage.auto_approve!
    workflow.update!(completed_count: succeeded, failed_count: failure_ids.length)
    workflow.mark_succeeded!
  rescue StandardError => error
    fail_ai_workflow!(workflow, error, context: "Wardrobe analysis backfill")
  end

  private

  def embed_item(item)
    analysis = item.wardrobe_item_analysis
    return true if embedding_current?(item, analysis)

    WardrobeItemAnalyzer.call(item)
    true
  rescue StandardError => error
    Rails.logger.error("Wardrobe backfill item #{item.id} failed: #{error.class}: #{error.message}")
    false
  end

  def embedding_current?(item, analysis)
    return false unless analysis

    fingerprints = WardrobeItemFingerprint.call(item)
    analysis.ready_for?(
      source_fingerprint: fingerprints.fetch(:source),
      metadata_fingerprint: fingerprints.fetch(:metadata),
      model: ENV.fetch("OPENROUTER_EMBEDDING_MODEL", OpenrouterWardrobeEmbedder::DEFAULT_MODEL),
      analysis_version: WardrobeItemAnalyzer::ANALYSIS_VERSION
    )
  end

  def current_embedding_count(items)
    items.count { |item| embedding_current?(item, item.reload.wardrobe_item_analysis) }
  end
end
