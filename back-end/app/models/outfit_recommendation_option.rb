class OutfitRecommendationOption < ApplicationRecord
  STATUSES = %w[candidate passing rejected].freeze

  belongs_to :outfit_recommendation_run, inverse_of: :options
  belongs_to :outfit, optional: true
  has_many :feedback_events, class_name: "OutfitRecommendationFeedbackEvent",
    dependent: :nullify, inverse_of: :outfit_recommendation_option

  enum :status, STATUSES.index_with(&:itself)

  validates :status, inclusion: { in: STATUSES }
  validates :rank, uniqueness: { scope: :outfit_recommendation_run_id }, allow_nil: true

  def clothing_items
    outfit_recommendation_run.user.clothing_items.where(id: clothing_item_ids)
  end
end
