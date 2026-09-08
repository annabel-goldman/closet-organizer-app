class WardrobeItemAnalysis < ApplicationRecord
  STATUSES = %w[pending processing succeeded failed].freeze

  belongs_to :clothing_item

  enum :status, STATUSES.index_with(&:itself)
  enum :enrichment_status, STATUSES.index_with(&:itself), prefix: :enrichment

  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :enrichment_status, presence: true, inclusion: { in: STATUSES }
  validates :clothing_item_id, uniqueness: true

  def ready_for?(source_fingerprint:, metadata_fingerprint:, model:, analysis_version:)
    succeeded? &&
      self.source_fingerprint == source_fingerprint &&
      self.metadata_fingerprint == metadata_fingerprint &&
      OpenrouterWardrobeEmbedder.same_model?(self.model, model) &&
      self.analysis_version == analysis_version &&
      embedding.present?
  end

  def enrichment_ready_for?(fingerprint:, model:, enrichment_version:)
    enrichment_succeeded? &&
      enrichment_fingerprint == fingerprint &&
      OpenrouterWardrobeEmbedder.same_model?(enrichment_model, model) &&
      self.enrichment_version == enrichment_version &&
      extracted_attributes["visual"].present?
  end
end
