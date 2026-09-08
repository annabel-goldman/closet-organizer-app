class WardrobeItemAnalysisJob < ApplicationJob
  queue_as :ai

  def perform(clothing_item_id)
    item = ClothingItem.find(clothing_item_id)
    return if item.user.ai_workflows.where(kind: "wardrobe_index", status: %w[pending processing]).exists?

    analysis = item.wardrobe_item_analysis
    fingerprints = WardrobeItemFingerprint.call(item)
    embedding_model = ENV.fetch("OPENROUTER_EMBEDDING_MODEL", OpenrouterWardrobeEmbedder::DEFAULT_MODEL)
    unless analysis&.ready_for?(
      source_fingerprint: fingerprints.fetch(:source),
      metadata_fingerprint: fingerprints.fetch(:metadata),
      model: embedding_model,
      analysis_version: WardrobeItemAnalyzer::ANALYSIS_VERSION
    )
      analysis = WardrobeItemAnalyzer.call(item)
    end

    enrichment_model = ENV.fetch("OPENROUTER_ENRICHMENT_MODEL", OpenrouterWardrobeEnricher::DEFAULT_MODEL)
    return if analysis.enrichment_ready_for?(
      fingerprint: WardrobeItemEnricher.fingerprint(item),
      model: enrichment_model,
      enrichment_version: WardrobeItemEnricher::ENRICHMENT_VERSION
    )

    WardrobeItemEnricher.call(item)
  rescue ActiveRecord::RecordNotFound
    nil
  rescue StandardError => error
    ClothingItem.find_by(id: clothing_item_id)&.wardrobe_item_analysis&.tap do |analysis|
      next if analysis.enrichment_succeeded? || analysis.enrichment_failed?

      analysis.update(
        enrichment_status: :failed,
        enrichment_error_message: "Embedding preparation failed. Retry this item to continue visual enrichment."
      )
    end
    Rails.logger.error("Wardrobe item analysis #{clothing_item_id} failed: #{error.class}: #{error.message}")
  end
end
