class OutfitRecommendationFeedbackEvent < ApplicationRecord
  EVENT_TYPES = %w[keep exclude swap best none save add_after_save remove_after_save].freeze

  belongs_to :user
  belongs_to :outfit_recommendation_run, inverse_of: :feedback_events
  belongs_to :outfit_recommendation_option, optional: true, inverse_of: :feedback_events
  belongs_to :clothing_item, optional: true

  validates :event_type, presence: true, inclusion: { in: EVENT_TYPES }
  validate :entities_belong_to_user

  private

  def entities_belong_to_user
    errors.add(:outfit_recommendation_run, "does not belong to this user") if
      outfit_recommendation_run && outfit_recommendation_run.user_id != user_id
    errors.add(:outfit_recommendation_option, "does not belong to this run") if
      outfit_recommendation_option && outfit_recommendation_option.outfit_recommendation_run_id != outfit_recommendation_run_id
    errors.add(:clothing_item, "does not belong to this user") if clothing_item && clothing_item.user_id != user_id
  end
end
