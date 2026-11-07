class OutfitRecommenderV2
  def self.enabled?
    ActiveModel::Type::Boolean.new.cast(ENV.fetch("OUTFIT_RECOMMENDER_V2", "true"))
  end

  def self.shortlist_size
    1
  end
end
