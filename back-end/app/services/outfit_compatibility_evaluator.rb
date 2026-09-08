class OutfitCompatibilityEvaluator
  MINIMUM_PASS_RATE = 0.70

  def self.call(user)
    new(user).call
  end

  def initialize(user)
    @user = user
  end

  def call
    comparisons = user.outfits.includes(clothing_items: :wardrobe_item_analysis).filter_map do |outfit|
      positive = outfit.clothing_items.select { |item| item.wardrobe_item_analysis&.embedding&.any? }
      next if positive.length < 2

      corrupted = corrupted_version(positive)
      next if corrupted == positive

      scorer = OutfitRecommendationScorer.new(
        brief: evaluation_brief(outfit),
        query_embedding: average_embedding(positive),
        preference_profile: OutfitPreferenceProfileBuilder.call(user)
      )
      positive_score = scorer.combination_score(positive)
      corrupted_score = scorer.combination_score(corrupted)
      {
        outfit_id: outfit.id,
        positive_score: positive_score.round(4),
        corrupted_score: corrupted_score.round(4),
        passed: positive_score > corrupted_score
      }
    end
    pass_rate = comparisons.empty? ? 0.0 : comparisons.count { |value| value[:passed] }.to_f / comparisons.length
    { comparisons: comparisons, pass_rate: pass_rate.round(4), passed: comparisons.any? && pass_rate >= MINIMUM_PASS_RATE }
  end

  private

  attr_reader :user

  def corrupted_version(items)
    replacements = user.clothing_items.joins(:wardrobe_item_analysis)
      .where(wardrobe_item_analyses: { status: "succeeded" })
      .where.not(id: items.map(&:id))
      .includes(:wardrobe_item_analysis)
      .group_by(&:category)
    replaced = false
    items.map do |item|
      replacement = replacements[item.category]&.first
      if replacement
        replaced = true
        replacement
      else
        item
      end
    end.tap { return items unless replaced }
  end

  def evaluation_brief(outfit)
    {
      "preferred_colors" => [], "excluded_colors" => [],
      "style_terms" => TagListNormalizer.call(outfit.tags), "material_terms" => [], "seasons" => [],
      "formality" => 2, "pattern_strategy" => "cohesive", "silhouette_strategy" => "balanced"
    }
  end

  def average_embedding(items)
    embeddings = items.map { |item| item.wardrobe_item_analysis.embedding.map(&:to_f) }
    dimensions = embeddings.map(&:length).min.to_i
    return [] if dimensions.zero?

    Array.new(dimensions) { |index| embeddings.sum { |embedding| embedding[index] } / embeddings.length.to_f }
  end
end
