class OutfitRecommendationFeedbackRecorder
  def self.call(user:, run:, event_type:, option: nil, clothing_item: nil, metadata: {})
    event = user.outfit_recommendation_feedback_events.create!(
      outfit_recommendation_run: run,
      outfit_recommendation_option: option,
      clothing_item: clothing_item,
      event_type: event_type,
      metadata: metadata
    )
    OutfitPreferenceProfileBuilder.call(user, refresh: true)
    event
  end
end
