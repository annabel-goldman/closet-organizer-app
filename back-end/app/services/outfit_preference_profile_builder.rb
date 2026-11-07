class OutfitPreferenceProfileBuilder
  HALF_LIFE_DAYS = 180.0
  EVENT_WEIGHTS = {
    "keep" => 2.0,
    "exclude" => -3.0,
    "swap" => -2.0,
    "best" => 3.0,
    "none" => -1.5,
    "save" => 4.0,
    "add_after_save" => 2.0,
    "remove_after_save" => -2.5
  }.freeze

  def self.call(user, refresh: false, excluded_outfit_ids: [])
    new(user, excluded_outfit_ids: excluded_outfit_ids).call(refresh: refresh)
  end

  def initialize(user, excluded_outfit_ids: [])
    @user = user
    @excluded_outfit_ids = excluded_outfit_ids
  end

  def call(refresh: false)
    return build_profile if @excluded_outfit_ids.any?
    profile = user.outfit_preference_profile || user.build_outfit_preference_profile(
      version: OutfitPreferenceProfile::CURRENT_VERSION
    )
    return profile.profile_data unless refresh || profile.new_record? || profile.version != OutfitPreferenceProfile::CURRENT_VERSION

    data = build_profile
    profile.update!(
      profile_data: data,
      version: OutfitPreferenceProfile::CURRENT_VERSION,
      rebuilt_at: Time.current
    )
    data
  end

  private

  attr_reader :user

  def build_profile
    item_scores = Hash.new(0.0)
    pair_scores = Hash.new(0.0)
    attribute_scores = Hash.new(0.0)
    event_count = 0

    user.outfits.where.not(id: @excluded_outfit_ids).includes(:clothing_items).find_each do |outfit|
      weight = 1.5 * decay(outfit.updated_at)
      apply_combination(outfit.clothing_items.to_a, weight, item_scores, pair_scores, attribute_scores)
    end

    user.outfit_recommendation_feedback_events
      .includes(:clothing_item, outfit_recommendation_option: :outfit_recommendation_run)
      .find_each do |event|
        next if held_out_feedback?(event)
        event_count += 1
        weight = EVENT_WEIGHTS.fetch(event.event_type) * decay(event.created_at)
        items = feedback_items(event)
        if items.any?
          apply_combination(items, weight, item_scores, pair_scores, attribute_scores)
        elsif event.event_type == "none" && event.outfit_recommendation_run
          event.outfit_recommendation_run.options.passing.each do |option|
            apply_combination(option.clothing_items.to_a, weight, item_scores, pair_scores, attribute_scores)
          end
        end
      end

    {
      "item_scores" => rounded_hash(item_scores),
      "pair_scores" => rounded_hash(pair_scores),
      "attribute_scores" => rounded_hash(attribute_scores),
      "source_outfit_count" => user.outfits.where.not(id: @excluded_outfit_ids).count,
      "feedback_event_count" => event_count
    }
  end

  def feedback_items(event)
    return [ event.clothing_item ] if event.clothing_item
    return event.outfit_recommendation_option.clothing_items.to_a if event.outfit_recommendation_option

    []
  end

  def held_out_feedback?(event)
    return false if @excluded_outfit_ids.empty?
    held_ids = user.outfits.where(id: @excluded_outfit_ids).joins(:clothing_items).pluck("clothing_items.id").uniq
    option = event.outfit_recommendation_option
    return true if option && @excluded_outfit_ids.include?(option.outfit_id)
    return true if event.clothing_item_id && held_ids.include?(event.clothing_item_id)

    run_items = event.outfit_recommendation_run&.candidate_item_sets.to_a.flat_map { |candidate| candidate["item_ids"] || [] }
    (run_items & held_ids).any?
  end

  def apply_combination(items, weight, item_scores, pair_scores, attribute_scores)
    items.each do |item|
      item_scores[item.id.to_s] += weight
      preference_attributes(item).each { |attribute| attribute_scores[attribute] += weight * 0.5 }
    end
    items.combination(2).each do |left, right|
      pair_scores[[ left.id, right.id ].sort.join(":")] += weight
    end
  end

  def preference_attributes(item)
    analysis = item.wardrobe_item_analysis
    attrs = analysis&.extracted_attributes || {}
    visual = attrs["visual"] || {}
    [
      item.category,
      *Array(attrs["styles"]),
      *Array(visual["materials"]),
      *Array(visual["patterns"]),
      visual["silhouette"],
      visual["fit"],
      visual["statement_role"]
    ].compact.map { |value| value.to_s.downcase }.uniq
  end

  def decay(timestamp)
    age_days = [ (Time.current - timestamp) / 1.day, 0 ].max
    0.5**(age_days / HALF_LIFE_DAYS)
  end

  def rounded_hash(values)
    values.transform_values { |value| value.round(4) }
  end
end
