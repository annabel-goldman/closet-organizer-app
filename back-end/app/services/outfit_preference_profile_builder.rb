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

  def self.call(user, refresh: false)
    new(user).call(refresh: refresh)
  end

  def initialize(user)
    @user = user
  end

  def call(refresh: false)
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

    user.outfits.includes(:clothing_items).find_each do |outfit|
      weight = 1.5 * decay(outfit.updated_at)
      apply_combination(outfit.clothing_items.to_a, weight, item_scores, pair_scores, attribute_scores)
    end

    user.outfit_recommendation_feedback_events
      .includes(:clothing_item, outfit_recommendation_option: :outfit_recommendation_run)
      .find_each do |event|
        weight = EVENT_WEIGHTS.fetch(event.event_type) * decay(event.created_at)
        items = feedback_items(event)
        if items.any?
          apply_combination(items, weight, item_scores, pair_scores, attribute_scores)
        elsif event.event_type == "none" && event.outfit_recommendation_run
          event.outfit_recommendation_run.options.each do |option|
            apply_combination(option.clothing_items.to_a, weight, item_scores, pair_scores, attribute_scores)
          end
        end
      end

    {
      "item_scores" => rounded_hash(item_scores),
      "pair_scores" => rounded_hash(pair_scores),
      "attribute_scores" => rounded_hash(attribute_scores),
      "source_outfit_count" => user.outfits.count,
      "feedback_event_count" => user.outfit_recommendation_feedback_events.count
    }
  end

  def feedback_items(event)
    return [ event.clothing_item ] if event.clothing_item
    return event.outfit_recommendation_option.clothing_items.to_a if event.outfit_recommendation_option

    []
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
