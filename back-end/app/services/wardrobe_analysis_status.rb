class WardrobeAnalysisStatus
  def self.call(user)
    new(user).call
  end

  def initialize(user)
    @user = user
  end

  def call
    items = user.clothing_items.with_attached_photo.with_attached_cleaned_photo.includes(
      :wardrobe_item_analysis,
      image_versions: { image_attachment: :blob }
    ).to_a
    counts = Hash.new(0)

    items.each do |item|
      counts[status_for(item)] += 1
    end

    active_workflow = user.ai_workflows
      .where(kind: "wardrobe_index", status: %w[pending processing])
      .order(created_at: :desc)
      .first

    {
      total: items.length,
      ready: counts[:ready],
      pending: counts[:pending],
      processing: counts[:processing],
      failed: counts[:failed],
      stale: counts[:stale],
      missing_image: counts[:missing_image],
      complete: items.any? && counts.values_at(:ready, :failed, :missing_image).sum == items.length,
      workflow: active_workflow
    }
  end

  private

  attr_reader :user

  def status_for(item)
    return :missing_image unless item.display_photo_attachment.attached?

    analysis = item.wardrobe_item_analysis
    return :stale unless analysis
    return analysis.status.to_sym unless analysis.succeeded?

    fingerprints = WardrobeItemFingerprint.call(item)
    return :ready if analysis.ready_for?(
      source_fingerprint: fingerprints.fetch(:source),
      metadata_fingerprint: fingerprints.fetch(:metadata),
      model: ENV.fetch("OPENROUTER_EMBEDDING_MODEL", OpenrouterWardrobeEmbedder::DEFAULT_MODEL),
      analysis_version: WardrobeItemAnalyzer::ANALYSIS_VERSION
    )

    :stale
  rescue StandardError
    :stale
  end
end
