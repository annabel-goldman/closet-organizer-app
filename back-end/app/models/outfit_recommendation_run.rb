class OutfitRecommendationRun < ApplicationRecord
  STATUSES = %w[pending processing succeeded failed].freeze

  belongs_to :user
  belongs_to :parent_run, class_name: "OutfitRecommendationRun", optional: true
  has_many :retry_runs, class_name: "OutfitRecommendationRun", foreign_key: :parent_run_id,
    dependent: :nullify, inverse_of: :parent_run
  has_many :options, -> { order(:rank, :id) }, class_name: "OutfitRecommendationOption",
    dependent: :destroy, inverse_of: :outfit_recommendation_run
  has_many :feedback_events, class_name: "OutfitRecommendationFeedbackEvent",
    dependent: :destroy, inverse_of: :outfit_recommendation_run
  has_many :ai_workflows, as: :subject, dependent: :destroy

  enum :status, STATUSES.index_with(&:itself)

  validates :prompt, presence: true
  validates :status, inclusion: { in: STATUSES }

  def latest_workflow
    ai_workflows.order(created_at: :desc).first
  end
end
