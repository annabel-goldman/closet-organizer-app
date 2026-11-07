require "digest"

class OutfitRecommendationBuilder
  DEFAULT_SHORTLIST_COUNT = 6
  CANDIDATES_PER_ROLE = 16
  BEAM_WIDTH = 120

  def self.call(user:, prompt:, locked_item_ids: [], excluded_item_ids: [], shortlist_count: 6, brief: nil, method: "contextual", pools: nil, preference_profile: nil)
    new(
      user: user,
      prompt: prompt,
      locked_item_ids: locked_item_ids,
      excluded_item_ids: excluded_item_ids,
      shortlist_count: shortlist_count,
      brief: brief, method: method, pools: pools, preference_profile: preference_profile
    ).call
  end

  def initialize(user:, prompt:, locked_item_ids:, excluded_item_ids:, shortlist_count:, brief: nil, method: "contextual", pools: nil, preference_profile: nil)
    @user = user
    @prompt = prompt.to_s.squish
    @locked_item_ids = normalize_ids(locked_item_ids)
    @excluded_item_ids = normalize_ids(excluded_item_ids)
    raise "A piece cannot be both kept and excluded." if (@locked_item_ids & @excluded_item_ids).any?
    @shortlist_count = shortlist_count.to_i.clamp(1, DEFAULT_SHORTLIST_COUNT)
    @supplied_brief = brief
    @method = method
    @supplied_pools = pools
    @profile = preference_profile
    @role_usage = []
  end

  def call
    items = available_items
    locked_items = resolve_locked_items(items)
    brief = (supplied_brief || parse_brief(locked_items)).deep_dup
    query_result = OpenrouterWardrobeEmbedder.embed_query(search_query(brief))
    profile = @profile || OutfitPreferenceProfileBuilder.call(user)
    scorer = OutfitRecommendationScorer.new(
      brief: brief,
      query_embedding: query_result.fetch(:embedding),
      preference_profile: profile
    )
    candidate_items = items.reject { |item| locked_item_ids.include?(item.id) || excluded_item_ids.include?(item.id) }
    adapt_roles!(brief, (candidate_items + locked_items).reject { |item| scorer.hard_violation?([ item ]) })
    @role_pools = @supplied_pools || build_role_pools(brief, candidate_items, profile)
    beams = assemble(brief, locked_items, candidate_items, scorer)
    if @method == "visual"
      visual_beams = OpenrouterOutfitSelector.call(brief: brief, pools: @role_pools, locked_items: locked_items, count: shortlist_count)
      beams = visual_beams if visual_beams.any?
    end
    if beams.all?(&:empty?)
      beams = candidate_items.reject { |item| scorer.hard_violation?([ item ]) }.sort_by { |item| -scorer.item_score(item) }.first(shortlist_count).map { |item| locked_items + [ item ] }
    end
    beams.select! { |outfit| OutfitStructure.eligible?(outfit, brief: brief, user_id: user.id, locked_ids: locked_item_ids, excluded_ids: excluded_item_ids) }
    selected = diversify(beams, scorer, locked_items.map(&:id))
    # Compare a prop-free base as well as accessorized variants. Optional details
    # should never crowd all simpler alternatives out of the visual shortlist.
    base = Array(@base_beams).reject(&:empty?).max_by { |outfit| scorer.combination_score(outfit) }
    selected = ([ base ] + selected).uniq { |outfit| outfit.map(&:id).sort }.first(shortlist_count) if base && @method != "visual" && shortlist_count > 1
    raise "No available analyzed pieces remain after your explicit exclusions." if selected.empty?

    {
      brief: brief.except("usage", "model"),
      provider: "openrouter",
      pools: @role_pools,
      models: {
        planner: brief["model"] || configured_planner_model,
        embedding: query_result.fetch(:model)
      },
      usage: {
        query_embedding: query_result.fetch(:usage, {}), role_embeddings: @role_usage
      }.merge(brief["usage"] ? { planner: brief["usage"] } : {}),
      recommendations: selected.each_with_index.map do |outfit_items, index|
        {
          id: recommendation_id(outfit_items),
          title: "#{brief['occasion'].presence || brief['summary'].presence || 'Styled'} Look #{index + 1}",
          summary: brief["summary"],
          item_ids: outfit_items.map(&:id),
          items: outfit_items,
          score: scorer.combination_score(outfit_items).round(4),
          reasons: scorer.reasons(outfit_items)
        }
      end
    }
  end

  private

  attr_reader :excluded_item_ids, :locked_item_ids, :prompt, :shortlist_count, :supplied_brief, :user

  def normalize_ids(values)
    Array(values).filter_map { |value| Integer(value, exception: false) }.select(&:positive?).uniq
  end

  def parse_brief(locked_items)
    return OpenrouterOutfitBriefParser.call(prompt) if locked_items.empty?

    OpenrouterOutfitBriefParser.call(prompt, locked_items: locked_items)
  end

  def available_items
    user.clothing_items
      .joins(:wardrobe_item_analysis)
      .where(wardrobe_item_analyses: { status: "succeeded" })
      .includes(:wardrobe_item_analysis, image_versions: { image_attachment: :blob })
      .with_attached_photo
      .with_attached_cleaned_photo
      .to_a
      .select { |item| item.display_photo_attachment.attached? && current_analysis?(item) }
  end

  def current_analysis?(item)
    fingerprints = WardrobeItemFingerprint.call(item)
    item.wardrobe_item_analysis.ready_for?(
      source_fingerprint: fingerprints.fetch(:source),
      metadata_fingerprint: fingerprints.fetch(:metadata),
      model: ENV.fetch("OPENROUTER_EMBEDDING_MODEL", OpenrouterWardrobeEmbedder::DEFAULT_MODEL),
      analysis_version: WardrobeItemAnalyzer::ANALYSIS_VERSION
    )
  end

  def resolve_locked_items(items)
    by_id = items.index_by(&:id)
    resolved = locked_item_ids.filter_map { |item_id| by_id[item_id] }
    raise "Kept items must be analyzed items from your closet." unless resolved.length == locked_item_ids.length

    resolved
  end

  def assemble(brief, locked_items, candidate_items, scorer)
    return [] if scorer.hard_violation?(locked_items)

    beams = [ locked_items ]
    required_roles, optional_roles = remaining_roles(brief, locked_items)
    anchor_category = brief.dig("anchor", "category")
    required_roles.sort_by! { |role| role["category"] == anchor_category ? 0 : role["layer"].to_i + 1 }

    required_roles.each do |role|
      candidates = ranked_for_role(candidate_items, role, scorer)
      next if candidates.empty?

      expanded = expand(beams, candidates, scorer)
      beams = expanded if expanded.any?
    end

    @base_beams = beams
    optional_roles.each do |role|
      candidates = ranked_for_role(candidate_items, role, scorer).first(8)
      next if candidates.empty?

      beams = (beams + expand(beams, candidates, scorer))
        .uniq { |outfit| outfit.map(&:id).sort }
        .sort_by { |outfit| -scorer.combination_score(outfit) }
        .first(BEAM_WIDTH)
    end
    beams
  end

  def remaining_roles(brief, locked_items)
    covered = locked_items.dup
    required = []
    optional = []
    OutfitStructure.roles(brief).sort_by { |role| locked_items.count { |item| OutfitStructure.matches?(item, role) } }.each do |role|
      match = covered.find { |item| OutfitStructure.matches?(item, role) }
      if match
        covered.delete(match)
      elsif role["required"] == false || %w[accessory outerwear].include?(role["category"])
        optional << role
      else
        required << role
      end
    end

    [ required, optional ]
  end

  def ranked_for_role(items, role, scorer)
    @role_pools.fetch(role.fetch("role_id"), []).select { |item| items.include?(item) && !scorer.hard_violation?([ item ]) }
  end

  def build_role_pools(brief, items, profile)
    OutfitStructure.roles(brief).to_h do |role|
      query = [ prompt, role["name"], role["description"], brief["preferred_colors"], brief["material_terms"] ].join(" | ")
      result = OpenrouterWardrobeEmbedder.embed_query(query)
      @role_usage << result.fetch(:usage, {})
      scorer = OutfitRecommendationScorer.new(brief: brief, query_embedding: result.fetch(:embedding), preference_profile: profile)
      pool = items.select { |item| OutfitStructure.matches?(item, role) && !scorer.hard_violation?([ item ]) }
        .sort_by { |item| -scorer.item_score(item) }.first(CANDIDATES_PER_ROLE)
      [ role.fetch("role_id"), pool ]
    end
  end

  def adapt_roles!(brief, items)
    roles = OutfitStructure.roles(brief)
    compromises = []
    roles.reject! do |role|
      missing = items.none? { |item| OutfitStructure.matches?(item, role) }
      if missing
        compromises << "No available #{role['name']} matches that role."
        brief["anchor"] = {} if role["category"] == brief.dig("anchor", "category")
      end
      missing
    end
    categories = roles.pluck("category")
    if !(categories.include?("dress") || (%w[top bottom] - categories).empty? || categories.include?("swimwear")) && items.any? { |item| item.category == "dress" }
      roles.reject! { |role| %w[top bottom].include?(role["category"]) }
      roles << OutfitStructure.role("dress")
      compromises << "Used a dress to provide complete clothing coverage."
    end
    brief["garment_roles"] = roles
    brief["garment_roles"] = OutfitStructure.roles(brief)
    brief["required_categories"] = brief["garment_roles"].select { |role| role["required"] != false }.pluck("category")
    brief["structure"] = brief["required_categories"].include?("dress") ? "dress" : (brief["required_categories"].include?("swimwear") ? "swimwear" : "separates")
    brief["compromises"] = compromises
  end

  def expand(beams, candidates, scorer)
    beams.flat_map do |outfit|
      candidates.filter_map do |candidate|
        next if outfit.any? { |item| item.id == candidate.id }

        expanded = outfit + [ candidate ]
        next if scorer.hard_violation?(expanded)

        expanded
      end
    end.sort_by { |outfit| -scorer.partial_score(outfit) }.first(BEAM_WIDTH)
  end

  def diversify(beams, scorer, locked_ids)
    ranked = beams.uniq { |outfit| outfit.map(&:id).sort }
      .sort_by { |outfit| -scorer.combination_score(outfit) }
    selected = []

    ranked.each do |candidate|
      flexible_ids = candidate.map(&:id) - locked_ids
      sufficiently_different = selected.all? do |chosen|
        chosen_ids = chosen.map(&:id) - locked_ids
        overlap = (flexible_ids & chosen_ids).length
        denominator = [ flexible_ids.length, chosen_ids.length, 1 ].max
        overlap.to_f / denominator <= 0.75
      end
      selected << candidate if sufficiently_different
      break if selected.length == shortlist_count
    end

    (selected + ranked).uniq { |outfit| outfit.map(&:id).sort }.first(shortlist_count)
  end

  def search_query(brief)
    [
      prompt,
      "anchor: #{brief.dig('anchor', 'description')}",
      "silhouette: #{brief['silhouette_strategy']}",
      "palette: #{brief['palette_strategy']}",
      ("colors: #{brief['preferred_colors'].join(', ')}" if Array(brief["preferred_colors"]).any?),
      ("styles: #{brief['style_terms'].join(', ')}" if Array(brief["style_terms"]).any?),
      "weather: #{brief['weather']}",
      "occasion: #{brief['occasion']}"
    ].compact.join(" | ")
  end

  def recommendation_id(items)
    Digest::SHA256.hexdigest(items.map(&:id).sort.join("-"))[0, 12]
  end

  def configured_planner_model
    ENV.fetch("OPENROUTER_OUTFIT_PLANNER_MODEL", OpenrouterOutfitBriefParser::DEFAULT_MODEL)
  end
end
