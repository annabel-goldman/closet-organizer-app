class OutfitRecommenderV2
  def self.enabled?
    ActiveModel::Type::Boolean.new.cast(ENV.fetch("OUTFIT_RECOMMENDER_V2", "true"))
  end

  def self.shortlist_size
    Integer(ENV.fetch("OUTFIT_RECOMMENDATION_SHORTLIST_SIZE", 12)).clamp(3, 12)
  end
end
