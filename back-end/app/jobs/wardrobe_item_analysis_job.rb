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
      WardrobeItemAnalyzer.call(item)
    end
  rescue ActiveRecord::RecordNotFound
    nil
  rescue StandardError => error
    Rails.logger.error("Wardrobe item analysis #{clothing_item_id} failed: #{error.class}: #{error.message}")
  end
end
