require "digest"
require "set"

class OutfitCartRecommendationBuilder
  CANDIDATES_PER_CATEGORY = 12
  BASE_CANDIDATE_LIMIT = 80
  OPTIONAL_OUTERWEAR_LIMIT = 3
  OPTIONAL_ACCESSORY_LIMIT = 5
  VISUAL_SHORTLIST_SIZE = 6
  DIVERSITY_PENALTY = 0.16
  MAX_FORMALITY_GAP = 2
  MAX_WARMTH_GAP = 3
  RECENT_REJECTION_LIMIT = 20
  OUTFIT_STRUCTURES = [ %w[dress shoes], %w[top bottom shoes], %w[swimwear shoes] ].freeze

  def self.call(user:, prompt:, locked_item_ids: [], draft_metadata: {})
    new(user: user, prompt: prompt, locked_item_ids: locked_item_ids, draft_metadata: draft_metadata).call
  end

  def initialize(user:, prompt:, locked_item_ids:, draft_metadata: {})
    @user = user
    @prompt = prompt.to_s.squish.presence || "Create a cohesive, wearable outfit from my closet."
    @locked_item_ids = Array(locked_item_ids).filter_map { |value| Integer(value, exception: false) }.uniq
    @draft_metadata = draft_metadata.to_h.stringify_keys
  end

  def call
    locked_items = resolve_locked_items
    available_items = analyzed_items.reject { |item| locked_item_ids.include?(item.id) }
    raise "Add at least one photographed closet item before generating an outfit." if locked_items.empty? && available_items.empty?

    brief = structured_brief
    query = OpenrouterWardrobeEmbedder.embed_query(search_query(locked_items, brief))
    scorer = OutfitRecommendationScorer.new(
      brief: brief,
      query_embedding: query.fetch(:embedding),
      preference_profile: OutfitPreferenceProfileBuilder.call(user)
    )
    candidates = build_candidates(locked_items, available_items, scorer)
    raise "No compatible closet pieces were available for this outfit." if candidates.empty?

    shortlist = visual_shortlist(candidates, scorer)
    judgment, visual_error = judge(shortlist, brief)
    winner, evaluation = selected_candidate(shortlist, judgment)

    {
      brief: brief,
      models: {
        embedding: query.fetch(:model),
        visual_selector: judgment&.fetch(:model, nil)
      }.compact,
      usage: {
        query_embedding: query.fetch(:usage, {}),
        visual_selection: judgment&.fetch(:usage, {}) || {}
      },
      diagnostics: {
        "candidate_count" => candidates.length,
        "visual_shortlist_count" => shortlist.length,
        "visual_selection_fallback" => judgment.nil?,
        "visual_selection_error" => visual_error
      }.compact,
      recommendation: recommendation_payload(winner, evaluation, scorer)
    }
  end

  private

  attr_reader :draft_metadata, :locked_item_ids, :prompt, :user

  def resolve_locked_items
    items = user.clothing_items
      .where(id: locked_item_ids)
      .includes(:wardrobe_item_analysis, photo_attachment: :blob, cleaned_photo_attachment: :blob,
        image_versions: { image_attachment: :blob })
      .to_a
    raise ActiveRecord::RecordNotFound, "A selected closet item was not found." unless items.length == locked_item_ids.length

    locked_item_ids.filter_map { |item_id| items.find { |item| item.id == item_id } }
  end

  def analyzed_items
    user.clothing_items
      .joins(:wardrobe_item_analysis)
      .where(wardrobe_item_analyses: { status: "succeeded" })
      .includes(:wardrobe_item_analysis, photo_attachment: :blob, cleaned_photo_attachment: :blob,
        image_versions: { image_attachment: :blob })
      .to_a
      .select { |item| current_analysis?(item) && item.display_photo_attachment.attached? }
  end

  def current_analysis?(item)
    fingerprints = WardrobeItemFingerprint.call(item)
    item.wardrobe_item_analysis.ready_for?(
      source_fingerprint: fingerprints.fetch(:source),
      metadata_fingerprint: fingerprints.fetch(:metadata),
      model: ENV.fetch("OPENROUTER_EMBEDDING_MODEL", OpenrouterWardrobeEmbedder::DEFAULT_MODEL),
      analysis_version: WardrobeItemAnalyzer::ANALYSIS_VERSION
    )
  rescue StandardError
    false
  end

  def structured_brief
    request = [ draft_metadata["name"], TagListNormalizer.call(draft_metadata["tags"]).join(" "),
      draft_metadata["notes"], prompt ].compact.join(" ").downcase
    seasons = []
    seasons << "fall" if request.match?(/thanksgiving|autumn|fall/)
    seasons << "winter" if request.match?(/winter|snow|cold|holiday/)
    seasons << "spring" if request.match?(/spring/)
    seasons << "summer" if request.match?(/summer|beach|hot weather/)

    style_terms = []
    style_terms << "polished" if request.match?(/thanksgiving|dinner|date|office|work|formal|dressy/)
    style_terms << "comfortable" if request.match?(/thanksgiving|family|hosting|comfortable|casual/)
    style_terms << "festive" if request.match?(/thanksgiving|holiday|party|celebration/)
    style_terms << "casual" if request.match?(/casual|relaxed|everyday/)

    {
      "summary" => prompt,
      "user_request" => search_query([], nil),
      "occasion" => inferred_occasion(request),
      "preferred_colors" => [],
      "excluded_colors" => [],
      "excluded_item_terms" => [],
      "style_terms" => style_terms.uniq,
      "material_terms" => [],
      "seasons" => seasons.uniq,
      "formality" => inferred_formality(request),
      "pattern_strategy" => "one focal pattern with supporting solids",
      "silhouette_strategy" => "balanced, intentional proportions",
      "selection_guidance" => inferred_selection_guidance(request)
    }
  end

  def inferred_occasion(request)
    return "Thanksgiving gathering" if request.include?("thanksgiving")
    return "work" if request.match?(/office|work/)
    return "dinner or date" if request.match?(/dinner|date/)
    return "party" if request.match?(/party|celebration/)

    "general wear"
  end

  def inferred_formality(request)
    return 4 if request.match?(/black tie|formal|gala/)
    return 3 if request.match?(/thanksgiving|dinner|date|office|work|dressy|party/)
    return 1 if request.match?(/lounge|very casual|athleisure/)

    2
  end

  def inferred_selection_guidance(request)
    return "Choose a warm, polished autumn look that feels special but comfortable for a family meal. Avoid workwear, beachwear, and visibly clashing footwear." if request.include?("thanksgiving")

    "Choose the most visually cohesive complete look for the stated occasion. Favor intentional palette, proportion, season, formality, and footwear."
  end

  def search_query(locked_items, brief = nil)
    anchors = locked_items.map do |item|
      [ item.name, item.category, item.brand, item.style_notes, TagListNormalizer.call(item.tags).join(" ") ].compact.join(" ")
    end
    creative_brief = [
      ("Outfit concept or occasion: #{draft_metadata['name'].to_s.squish}" if draft_metadata["name"].present?),
      ("Requested tags and style direction: #{TagListNormalizer.call(draft_metadata['tags']).join(', ')}" if draft_metadata["tags"].present?),
      ("Styling notes and requirements: #{draft_metadata['notes'].to_s.squish}" if draft_metadata["notes"].present?),
      ("Styling interpretation: #{brief['selection_guidance']}" if brief)
    ].compact

    [ *creative_brief, prompt, ("Required closet pieces: #{anchors.join(' | ')}" if anchors.any?) ].compact.join(" | ")
  end

  def build_candidates(locked_items, available_items, scorer)
    base = structures_for(locked_items).flat_map do |categories|
      missing_categories = categories.reject { |category| locked_items.any? { |item| item.category == category } }
      pools = missing_categories.map do |category|
        ranked_items(available_items.select { |item| item.category == category }, scorer).first(CANDIDATES_PER_CATEGORY).presence || [ nil ]
      end
      choices = pools.empty? ? [ [] ] : pools.first.product(*pools.drop(1))
      choices.map { |choice| (locked_items + Array(choice).compact).uniq(&:id) }
    end
    base = [ locked_items ] if base.empty? && locked_items.any?
    base = ranked_items(available_items, scorer).first(1).map { |item| [ item ] } if base.empty?

    base = base
      .reject(&:empty?)
      .uniq { |items| item_key(items) }
      .reject { |items| locally_incompatible?(items) || recently_rejected?(items) }
    best_coverage = base.map { |items| structural_coverage(items) }.max
    base = base
      .select { |items| structural_coverage(items) == best_coverage }
      .sort_by { |items| [ -scorer.combination_score(items), item_key(items) ] }
      .first(BASE_CANDIDATE_LIMIT)

    outerwear = ranked_items(available_items.select { |item| item.category == "outerwear" }, scorer)
      .first(OPTIONAL_OUTERWEAR_LIMIT)
    accessories = ranked_items(available_items.select { |item| item.category == "accessory" }, scorer)
      .first(OPTIONAL_ACCESSORY_LIMIT)

    base.flat_map do |items|
      additions = [ items ]
      additions.concat(outerwear.filter_map { |item| add_optional(items, item) })
      additions.concat(accessories.filter_map { |item| add_optional(items, item) })
      additions.concat(outerwear.product(accessories).filter_map { |coat, accessory| add_optional(add_optional(items, coat), accessory) })
      additions
    end
      .compact
      .uniq { |items| item_key(items) }
      .reject { |items| locally_incompatible?(items) || recently_rejected?(items) }
      .sort_by { |items| [ -scorer.combination_score(items), item_key(items) ] }
  end

  def add_optional(items, item)
    return if items.blank? || item.nil? || items.any? { |existing| existing.id == item.id }

    items + [ item ]
  end

  def structures_for(locked_items)
    categories = locked_items.map(&:category)
    return [ %w[dress shoes] ] if categories.include?("dress")
    return [ %w[swimwear shoes] ] if categories.include?("swimwear")
    return [ %w[top bottom shoes] ] if (categories & %w[top bottom]).any?

    OUTFIT_STRUCTURES
  end

  def ranked_items(items, scorer)
    items.sort_by { |item| [ -scorer.item_score(item), item.id ] }
  end

  def locally_incompatible?(items)
    formalities = items.filter_map { |item| visual_number(item, "formality", fallback: "formality") }
    warmth = items.filter_map { |item| visual_number(item, "warmth") }
    (formalities.length > 1 && formalities.max - formalities.min > MAX_FORMALITY_GAP) ||
      (warmth.length > 1 && warmth.max - warmth.min > MAX_WARMTH_GAP)
  end

  def structural_coverage(items)
    categories = items.map(&:category)
    body = categories.include?("dress") || categories.include?("swimwear") || (%w[top bottom] - categories).empty?
    partial_body = (categories & %w[top bottom dress swimwear]).any?
    (body ? 2 : (partial_body ? 1 : 0)) + (categories.include?("shoes") ? 1 : 0)
  end

  def visual_number(item, key, fallback: nil)
    attributes = item.wardrobe_item_analysis.extracted_attributes || {}
    value = attributes.dig("visual", key).presence || (fallback && attributes[fallback])
    Float(value, exception: false)
  end

  def recent_rejected_item_sets
    @recent_rejected_item_sets ||= user.outfit_recommendation_feedback_events
      .where(event_type: "none")
      .order(created_at: :desc)
      .includes(:outfit_recommendation_option, outfit_recommendation_run: :options)
      .limit(RECENT_REJECTION_LIMIT)
      .flat_map do |event|
        option = event.outfit_recommendation_option
        options = option ? [ option ] : event.outfit_recommendation_run.options.select(&:passing?)
        options.map { |value| Set.new(Array(value.clothing_item_ids).map(&:to_i)) }
      end
      .reject(&:empty?)
  end

  def recently_rejected?(items)
    candidate_ids = Set.new(items.map(&:id))
    recent_rejected_item_sets.any? { |rejected_ids| rejected_ids.subset?(candidate_ids) }
  end

  def visual_shortlist(candidates, scorer)
    remaining = candidates.first(180).map do |items|
      { id: candidate_id(items), items: items, local_score: scorer.combination_score(items) }
    end
    selected = []
    while selected.length < VISUAL_SHORTLIST_SIZE && remaining.any?
      choice = remaining.max_by do |candidate|
        overlap = selected.map { |picked| item_overlap(candidate.fetch(:items), picked.fetch(:items)) }.max || 0.0
        [ candidate.fetch(:local_score) - (overlap * DIVERSITY_PENALTY), candidate.fetch(:id) ]
      end
      selected << choice
      remaining.delete(choice)
    end
    selected
  end

  def item_overlap(left, right)
    ignored = locked_item_ids.to_set
    left_ids = left.map(&:id).to_set - ignored
    right_ids = right.map(&:id).to_set - ignored
    union = left_ids | right_ids
    union.empty? ? 0.0 : (left_ids & right_ids).length.to_f / union.length
  end

  def judge(shortlist, brief)
    judgment = OpenrouterOutfitVisualJudge.new(
      brief: brief,
      candidates: shortlist,
      max_response_attempts: 1,
      max_output_tokens: 1_800
    ).call
    [ judgment, nil ]
  rescue StandardError => error
    Rails.logger.warn("Outfit visual selection failed; using local ranking: #{error.class}: #{error.message}")
    [ nil, "#{error.class}: #{error.message}".truncate(500) ]
  end

  def selected_candidate(shortlist, judgment)
    evaluation = judgment&.fetch(:passing, [])&.first
    winner = shortlist.find { |candidate| candidate.fetch(:id).to_s == evaluation&.fetch("candidate_id", nil).to_s }
    winner ||= shortlist.first
    [ winner, evaluation ]
  end

  def recommendation_payload(winner, evaluation, scorer)
    items = winner.fetch(:items)
    local_score = scorer.combination_score(items)
    visual_score = evaluation&.fetch("overall_score", nil)&.to_f
    {
      id: winner.fetch(:id),
      title: evaluation&.fetch("title", nil).presence || "AI Outfit",
      summary: evaluation&.fetch("summary", nil).presence || "",
      item_ids: items.map(&:id),
      items: items,
      score: (visual_score ? visual_score / 100.0 : local_score).round(4),
      reasons: evaluation&.fetch("reasons", nil).presence || scorer.reasons(items)
    }
  end

  def candidate_id(items)
    Digest::SHA256.hexdigest(item_key(items))[0, 12]
  end

  def item_key(items)
    items.map(&:id).sort.join("-")
  end
end
