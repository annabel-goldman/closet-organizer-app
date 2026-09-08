require "digest"

class WardrobeItemEnricher
  ENRICHMENT_VERSION = "wardrobe-visual-v1".freeze

  def self.call(item)
    new(item).call
  end

  def self.fingerprint(item)
    fingerprints = WardrobeItemFingerprint.call(item)
    Digest::SHA256.hexdigest([ fingerprints[:source], fingerprints[:metadata] ].join(":"))
  end

  def initialize(item)
    @item = item
  end

  def call
    attachment = item.display_photo_attachment
    raise "This closet item does not have an image to enrich." unless attachment.attached?

    analysis = item.wardrobe_item_analysis || item.build_wardrobe_item_analysis
    analysis.update!(
      enrichment_status: :processing,
      enrichment_model: configured_model,
      enrichment_version: ENRICHMENT_VERSION,
      enrichment_fingerprint: self.class.fingerprint(item),
      enrichment_error_message: nil
    )
    result = OpenrouterWardrobeEnricher.call(item, attachment: attachment)
    attributes = analysis.extracted_attributes.deep_dup
    attributes["visual"] = result.fetch(:attributes)
    attributes["enrichment_usage"] = result.fetch(:usage)
    analysis.update!(
      enrichment_status: :succeeded,
      enrichment_model: result.fetch(:model),
      extracted_attributes: attributes,
      enriched_at: Time.current,
      enrichment_error_message: nil
    )
    analysis
  rescue StandardError => error
    analysis&.update(enrichment_status: :failed, enrichment_error_message: error.message)
    raise
  end

  private

  attr_reader :item

  def configured_model
    ENV.fetch("OPENROUTER_ENRICHMENT_MODEL", OpenrouterWardrobeEnricher::DEFAULT_MODEL)
  end
end
