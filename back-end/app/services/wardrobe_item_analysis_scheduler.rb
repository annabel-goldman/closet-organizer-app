class WardrobeItemAnalysisScheduler
  def self.call(item, force: false)
    new(item, force: force).call
  end

  def initialize(item, force:)
    @item = item
    @force = force
  end

  def call
    return unless item.persisted?
    return unless item.display_photo_attachment.attached?

    fingerprints = WardrobeItemFingerprint.call(item)
    model = ENV.fetch("OPENROUTER_EMBEDDING_MODEL", OpenrouterWardrobeEmbedder::DEFAULT_MODEL)
    analysis = item.wardrobe_item_analysis || item.build_wardrobe_item_analysis
    embedding_ready = analysis.ready_for?(
      source_fingerprint: fingerprints.fetch(:source),
      metadata_fingerprint: fingerprints.fetch(:metadata),
      model: model,
      analysis_version: WardrobeItemAnalyzer::ANALYSIS_VERSION
    )
    return analysis if !force && embedding_ready
    return analysis if !force && analysis.status.in?(%w[pending processing]) &&
      analysis.source_fingerprint == fingerprints.fetch(:source) &&
      analysis.metadata_fingerprint == fingerprints.fetch(:metadata) &&
      OpenrouterWardrobeEmbedder.same_model?(analysis.model, model)

    update_attributes = {
      provider: "openrouter",
      model: model,
      analysis_version: WardrobeItemAnalyzer::ANALYSIS_VERSION,
      source_fingerprint: fingerprints.fetch(:source),
      metadata_fingerprint: fingerprints.fetch(:metadata),
      error_message: nil
    }
    update_attributes[:status] = :pending unless embedding_ready
    analysis.update!(update_attributes)
    WardrobeItemAnalysisJob.perform_later(item.id)
    analysis
  end

  private

  attr_reader :force, :item
end
