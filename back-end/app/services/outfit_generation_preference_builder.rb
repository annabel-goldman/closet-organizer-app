class OutfitGenerationPreferenceBuilder
  MAX_RUNS = 25
  MAX_EXAMPLES = 10
  MAX_ITEM_IDS = 12
  MAX_TERMS = 24
  TERM_STOP_WORDS = (OutfitReferenceMatcher::STOP_WORDS + %w[
    na unknown closet generated outfit look user added removed chose
  ]).uniq.freeze

  def self.call(user:, limit: MAX_RUNS)
    new(user: user, limit: limit).call
  end

  def initialize(user:, limit: MAX_RUNS)
    @user = user
    @limit = Integer(limit)
  end

  def call
    return empty_context if user.blank?

    build_context
  end

  private

  attr_reader :user, :limit

  def build_context
    {
      "preferred_item_ids" => ranked_item_ids(preferred_item_weights),
      "avoided_item_ids" => ranked_item_ids(avoided_item_weights),
      "preferred_terms" => ranked_terms(preferred_term_weights),
      "avoided_terms" => ranked_terms(avoided_term_weights),
      "examples" => examples.first(MAX_EXAMPLES)
    }
  end

  def empty_context
    {
      "preferred_item_ids" => [],
      "avoided_item_ids" => [],
      "preferred_terms" => [],
      "avoided_terms" => [],
      "examples" => []
    }
  end

  def recent_runs
    @recent_runs ||= user
      .outfit_generation_runs
      .includes(:outfit_generation_events)
      .order(generated_at: :desc, created_at: :desc)
      .limit(limit)
  end

  def preference_events
    @preference_events ||= recent_runs.flat_map do |run|
      run.outfit_generation_events.select do |event|
        [
          OutfitGenerationRun::EVENT_SAVED_WITH_ITEM_CHANGES,
          OutfitGenerationRun::EVENT_SAVED_UNCHANGED,
          OutfitGenerationRun::EVENT_DELETED
        ].include?(event.event_type)
      end.sort_by(&:created_at).reverse
    end
  end

  def preferred_item_weights
    @preferred_item_weights ||= Hash.new(0).tap do |weights|
      preference_events.each do |event|
        case event.event_type
        when OutfitGenerationRun::EVENT_SAVED_WITH_ITEM_CHANGES
          add_weights(weights, event.added_item_ids, 4)
          add_weights(weights, event.kept_item_ids, 1)
        when OutfitGenerationRun::EVENT_SAVED_UNCHANGED
          add_weights(weights, event.final_item_ids, 2)
        end
      end
    end
  end

  def avoided_item_weights
    @avoided_item_weights ||= Hash.new(0).tap do |weights|
      preference_events.each do |event|
        case event.event_type
        when OutfitGenerationRun::EVENT_SAVED_WITH_ITEM_CHANGES
          add_weights(weights, event.removed_item_ids, 2)
        when OutfitGenerationRun::EVENT_DELETED
          add_weights(weights, event.final_item_ids, 1)
        end
      end
    end
  end

  def preferred_term_weights
    @preferred_term_weights ||= term_weights_for(preferred_item_weights)
  end

  def avoided_term_weights
    @avoided_term_weights ||= term_weights_for(avoided_item_weights)
  end

  def add_weights(weights, item_ids, value)
    Array(item_ids).each do |item_id|
      weights[item_id.to_i] += value
    end
  end

  def ranked_item_ids(weights)
    weights
      .sort_by { |item_id, weight| [ -weight, item_name(item_id).to_s ] }
      .first(MAX_ITEM_IDS)
      .map(&:first)
  end

  def ranked_terms(weights)
    weights
      .sort_by { |term, weight| [ -weight, term ] }
      .first(MAX_TERMS)
      .map(&:first)
  end

  def term_weights_for(item_weights)
    Hash.new(0).tap do |weights|
      item_weights.each do |item_id, item_weight|
        tokens_for(item_text(items_by_id[item_id])).each do |token|
          weights[token] += item_weight
        end
      end
    end
  end

  def examples
    @examples ||= preference_events.filter_map do |event|
      case event.event_type
      when OutfitGenerationRun::EVENT_SAVED_WITH_ITEM_CHANGES
        edited_example(event)
      when OutfitGenerationRun::EVENT_SAVED_UNCHANGED
        kept_example(event)
      when OutfitGenerationRun::EVENT_DELETED
        deleted_example(event)
      end
    end
  end

  def edited_example(event)
    added = item_names(event.added_item_ids)
    removed = item_names(event.removed_item_ids)
    return if added.empty? && removed.empty?

    "User edited an AI outfit by adding #{added.to_sentence.presence || 'no new items'} and removing #{removed.to_sentence.presence || 'no items'}."
  end

  def kept_example(event)
    kept = item_names(event.final_item_ids)
    return if kept.empty?

    "User saved an AI outfit unchanged with #{kept.to_sentence}."
  end

  def deleted_example(event)
    deleted = item_names(event.final_item_ids)
    return if deleted.empty?

    "User deleted an AI outfit containing #{deleted.to_sentence}; treat this as weak negative feedback for that combination."
  end

  def item_names(item_ids)
    Array(item_ids).filter_map { |item_id| item_name(item_id) }
  end

  def item_name(item_id)
    items_by_id[item_id.to_i]&.name
  end

  def items_by_id
    @items_by_id ||= user.clothing_items.where(id: feedback_item_ids).index_by(&:id)
  end

  def feedback_item_ids
    @feedback_item_ids ||= preference_events.flat_map do |event|
      event.final_item_ids + event.added_item_ids + event.removed_item_ids + event.kept_item_ids
    end.map(&:to_i).uniq
  end

  def item_text(item)
    return "" unless item

    ([ item.name, item.category, item.brand, item.style_notes ] + TagListNormalizer.call(item.tags)).join(" ")
  end

  def tokens_for(value)
    value.to_s
      .downcase
      .scan(/[a-z0-9]+/)
      .reject { |token| TERM_STOP_WORDS.include?(token) || token.length <= 2 }
      .uniq
  end
end
