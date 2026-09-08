class OutfitRecommendationScorer
  MAX_PERSONALIZATION = 0.15

  def initialize(brief:, query_embedding:, preference_profile: {})
    @brief = brief
    @query_embedding = query_embedding
    @preference_profile = preference_profile || {}
  end

  def item_score(item)
    analysis = item.wardrobe_item_analysis
    semantic = normalized_cosine(query_embedding, analysis.embedding)
    color = requested_color_score(analysis)
    attributes = attribute_score(analysis)
    excluded_penalty = excluded_color_match?(analysis) ? 1.0 : 0.0
    base = (semantic * 0.50) + (color * 0.30) + (attributes * 0.20) - excluded_penalty
    (base + personalization_for_item(item)).clamp(0.0, 1.0)
  end

  def combination_score(items)
    return 0.0 if items.empty? || hard_violation?(items)

    base = items.sum { |item| item_score(item) } / items.length.to_f
    contextual = contextual_compatibility(items)
    coverage = requested_palette_coverage(items)
    score = (base * 0.60) + (contextual * 0.25) + (coverage * 0.15)
    (score + personalization_for_combination(items)).clamp(0.0, 1.0)
  end

  def partial_score(items)
    combination_score(items)
  end

  def hard_violation?(items)
    items.any? { |item| excluded_color_match?(item.wardrobe_item_analysis) } ||
      excessive_formality_gap?(items) || excessive_warmth_gap?(items) ||
      competing_statement_pieces?(items) || pattern_conflict?(items) || silhouette_conflict?(items)
  end

  def reasons(items)
    reasons = []
    reasons << "Matches the #{brief['preferred_colors'].to_sentence} palette" if Array(brief["preferred_colors"]).any?
    reasons << "Fits the #{brief['style_terms'].first(2).to_sentence} direction" if Array(brief["style_terms"]).any?
    reasons << "Balances silhouette, formality, and visual weight across the complete look"
    reasons.first(3)
  end

  private

  attr_reader :brief, :preference_profile, :query_embedding

  def normalized_cosine(left, right)
    return 0.0 if left.blank? || right.blank? || left.length != right.length

    dot = left.zip(right).sum { |a, b| a.to_f * b.to_f }
    magnitude = Math.sqrt(left.sum { |value| value.to_f**2 }) * Math.sqrt(right.sum { |value| value.to_f**2 })
    return 0.0 if magnitude.zero?

    ((dot / magnitude) + 1.0) / 2.0
  end

  def requested_color_score(analysis)
    names = Array(brief["preferred_colors"])
    return 0.65 if names.empty?
    return 1.0 if names.any? { |name| textual_color_match?(analysis, name) }

    targets = names.filter_map { |name| WardrobeColorLexicon.lab_for(name) }
    return 0.0 if targets.empty?

    colors = Array(analysis.dominant_colors).first(4)
    return 0.0 if colors.empty?

    distance = colors.product(targets).map { |color, target| ColorScience.delta_e(color["lab"], target) }.min
    (1.0 - (distance / 65.0)).clamp(0.0, 1.0)
  end

  def excluded_color_match?(analysis)
    names = Array(brief["excluded_colors"])
    return true if names.any? { |name| textual_color_match?(analysis, name) }

    targets = names.filter_map { |name| WardrobeColorLexicon.lab_for(name) }
    return false if targets.empty?

    Array(analysis.dominant_colors).first(3).any? do |color|
      targets.any? { |target| ColorScience.delta_e(color["lab"], target) < 18 }
    end
  end

  def textual_color_match?(analysis, color_name)
    normalized = color_name.to_s.downcase.squish
    return false if normalized.blank?

    visual_names = Array(analysis.extracted_attributes&.dig("visual", "color_proportions"))
      .filter_map { |color| color["name"]&.to_s&.downcase&.squish }
    visual_names.any? { |name| name == normalized || name.include?(normalized) || normalized.include?(name) }
  end

  def attribute_score(analysis)
    attributes = analysis.extracted_attributes || {}
    visual = attributes["visual"] || {}
    desired = Array(brief["style_terms"]) + Array(brief["material_terms"]) + Array(brief["seasons"])
    actual = %w[styles materials patterns seasons].flat_map { |key| Array(attributes[key]) } +
      Array(visual["materials"]) + Array(visual["patterns"])
    term_score = desired.empty? ? 0.65 : (desired & actual.map(&:downcase)).length.to_f / desired.length
    formality = visual["formality"].presence || attributes["formality"]
    formality_score = 1.0 - ((formality.to_i - brief["formality"].to_i).abs / 4.0)
    ((term_score * 0.65) + (formality_score * 0.35)).clamp(0.0, 1.0)
  end

  def contextual_compatibility(items)
    palette = palette_cohesion(items)
    formalities = items.map { |item| visual_value(item, "formality", fallback: "formality") }.compact.map(&:to_f)
    warmth = items.map { |item| visual_value(item, "warmth") }.compact.map(&:to_f)
    formality = range_score(formalities, 3.0)
    weather = range_score(warmth, 3.0)
    ((palette * 0.45) + (formality * 0.30) + (weather * 0.25)).clamp(0.0, 1.0)
  end

  def range_score(values, maximum)
    return 0.75 if values.length < 2

    (1.0 - ((values.max - values.min) / maximum)).clamp(0.0, 1.0)
  end

  def excessive_formality_gap?(items)
    values = items.map { |item| visual_value(item, "formality", fallback: "formality") }.compact.map(&:to_i)
    values.length > 1 && values.max - values.min > 2
  end

  def excessive_warmth_gap?(items)
    values = items.map { |item| visual_value(item, "warmth") }.compact.map(&:to_i)
    values.length > 1 && values.max - values.min > 2
  end

  def competing_statement_pieces?(items)
    return false if brief["pattern_strategy"].to_s.downcase.match?(/mix|maximal|statement/)

    items.count { |item| visual_value(item, "statement_role") == "statement" } > 1
  end

  def pattern_conflict?(items)
    return false if brief["pattern_strategy"].to_s.downcase.match?(/mix|maximal/)

    patterned = items.count do |item|
      patterns = Array(visual_value(item, "patterns"))
      patterns = Array(item.wardrobe_item_analysis.extracted_attributes["patterns"]) if patterns.empty?
      patterns.any? { |pattern| pattern.to_s.downcase != "solid" }
    end
    patterned > 1
  end

  def silhouette_conflict?(items)
    strategy = brief["silhouette_strategy"].to_s.downcase
    return false if strategy.match?(/oversized|relaxed|volume|maximal|loose throughout/)

    top = items.find { |item| %w[top outerwear].include?(item.category) }
    bottom = items.find { |item| item.category == "bottom" }
    return false unless top && bottom

    voluminous = /oversized|loose|wide|relaxed|boxy|full/
    top_fit = [ visual_value(top, "fit"), visual_value(top, "silhouette") ].compact.join(" ").downcase
    bottom_fit = [ visual_value(bottom, "fit"), visual_value(bottom, "silhouette") ].compact.join(" ").downcase
    top_fit.match?(voluminous) && bottom_fit.match?(voluminous)
  end

  def visual_value(item, key, fallback: nil)
    attributes = item.wardrobe_item_analysis.extracted_attributes || {}
    attributes.dig("visual", key).presence || (fallback && attributes[fallback])
  end

  def palette_cohesion(items)
    labs = items.filter_map { |item| item.wardrobe_item_analysis.dominant_colors.first&.fetch("lab", nil) }
    return 0.7 if labs.length < 2

    distances = labs.combination(2).map { |left, right| ColorScience.delta_e(left, right) }
    average = distances.sum / distances.length.to_f
    (1.0 - ((average - 32).abs / 65.0)).clamp(0.0, 1.0)
  end

  def requested_palette_coverage(items)
    targets = Array(brief["preferred_colors"]).filter_map { |name| WardrobeColorLexicon.lab_for(name) }
    return 0.7 if targets.empty?

    colors = items.flat_map { |item| Array(item.wardrobe_item_analysis.dominant_colors).first(3) }
    matched = targets.count { |target| colors.any? { |color| ColorScience.delta_e(color["lab"], target) < 25 } }
    matched.to_f / targets.length
  end

  def personalization_for_item(item)
    return 0.0 unless item.respond_to?(:id) && item.id

    raw = preference_profile.fetch("item_scores", {}).fetch(item.id.to_s, 0).to_f
    normalize_preference(raw) * 0.06
  end

  def personalization_for_combination(items)
    pairs = items.combination(2).map do |left, right|
      preference_profile.fetch("pair_scores", {}).fetch([ left.id, right.id ].sort.join(":"), 0).to_f
    end
    return 0.0 if pairs.empty?

    (normalize_preference(pairs.sum / pairs.length) * 0.09).clamp(-MAX_PERSONALIZATION, MAX_PERSONALIZATION)
  end

  def normalize_preference(value)
    Math.tanh(value / 5.0)
  end
end
