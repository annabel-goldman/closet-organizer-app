class WardrobeItemAnalyzer
  ANALYSIS_VERSION = "wardrobe-item-v1".freeze

  def self.call(item)
    new(item).call
  end

  def initialize(item)
    @item = item
  end

  def call
    attachment = item.display_photo_attachment
    raise "This closet item does not have an image to analyze." unless attachment.attached?

    fingerprints = WardrobeItemFingerprint.call(item)
    analysis = item.wardrobe_item_analysis || item.build_wardrobe_item_analysis
    retained_attributes = analysis.extracted_attributes.slice("visual", "enrichment_usage")
    analysis.update!(
      status: :processing,
      source_fingerprint: fingerprints.fetch(:source),
      metadata_fingerprint: fingerprints.fetch(:metadata),
      model: configured_model,
      analysis_version: ANALYSIS_VERSION,
      error_message: nil
    )

    embedding_result = OpenrouterWardrobeEmbedder.embed_item(item, attachment: attachment)
    colors = WardrobeColorAnalyzer.call(attachment)
    analysis.update!(
      status: :succeeded,
      provider: embedding_result.fetch(:provider),
      model: embedding_result.fetch(:model),
      embedding: embedding_result.fetch(:embedding),
      dominant_colors: colors,
      extracted_attributes: WardrobeItemAttributeExtractor.call(item)
        .merge(retained_attributes)
        .merge("usage" => embedding_result.fetch(:usage)),
      analyzed_at: Time.current,
      error_message: nil
    )
    analysis
  rescue StandardError => error
    analysis&.update(status: :failed, error_message: error.message)
    raise
  end

  private

  attr_reader :item

  def configured_model
    ENV.fetch("OPENROUTER_EMBEDDING_MODEL", OpenrouterWardrobeEmbedder::DEFAULT_MODEL)
  end
end
