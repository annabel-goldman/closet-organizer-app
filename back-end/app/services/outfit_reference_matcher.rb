class OutfitReferenceMatcher
  ROLE_TERMS = {
    "top" => %w[top shirt tee t-shirt blouse sweater sweatshirt hoodie tank camisole cardigan vest],
    "bottom" => %w[bottom pants jeans shorts skirt trouser trousers sweatpants],
    "dress" => %w[dress gown romper jumpsuit],
    "outerwear" => %w[jacket coat blazer cardigan hoodie raincoat puffer],
    "shoes" => %w[shoe shoes sneaker sneakers boot boots heel heels sandal sandals flat flats pump pumps mule mules],
    "bag" => %w[bag handbag purse tote crossbody clutch hobo satchel shoulder],
    "accessory" => %w[accessory sunglasses jewelry necklace bracelet ring belt scarf hat perfume mascara]
  }.freeze

  STOP_WORDS = %w[
    a an and are as at be by for from has in is it of on or the this to with
    item piece garment clothing visible
  ].freeze

  def initialize(reference_profile, preference_context: nil)
    @reference_profile = reference_profile || {}
    @preference_context = preference_context || {}
  end

  def required_slots
    target_slots.select { |slot| truthy?(slot_value(slot, "required")) }
  end

  def target_slots
    Array(profile_value("target_slots"))
  end

  def best_candidate_ids_by_slot(items, limit_per_slot: 3)
    target_slots.flat_map do |slot|
      ranked_items_for_slot(items, slot)
        .first(limit_per_slot)
        .map { |entry| entry[:item].id }
    end.uniq
  end

  def best_signature_candidate_ids(items, limit: 8)
    Array(items)
      .map { |item| { item: item, score: score_item_for_signature(item) } }
      .select { |entry| entry[:score].positive? }
      .sort_by { |entry| [ -entry[:score], entry[:item].name.to_s ] }
      .first(limit)
      .map { |entry| entry[:item].id }
  end

  def missing_required_slots(selected_items, candidate_items)
    required_slots.filter do |slot|
      selected_best = ranked_items_for_slot(selected_items, slot).first
      candidate_best = ranked_items_for_slot(candidate_items, slot).first
      candidate_best.present? && slot_match?(candidate_best, slot) && !slot_match?(selected_best, slot)
    end
  end

  def repair_selection(item_ids, candidate_items, max_items:)
    return item_ids if required_slots.empty?

    selected_ids = item_ids.dup
    candidate_items_by_id = candidate_items.index_by(&:id)

    required_slots.each do |slot|
      selected_ids = repair_missing_slot_match(selected_ids, candidate_items, candidate_items_by_id, slot, max_items)
    end

    required_slots.each do |slot|
      selected_ids = upgrade_weak_slot_match(selected_ids, candidate_items, candidate_items_by_id, slot)
    end

    selected_ids.uniq.first(max_items)
  end

  def ranked_items_for_slot(items, slot)
    Array(items)
      .map { |item| { item: item, score: score_item_for_slot(item, slot) } }
      .select { |entry| entry[:score].positive? }
      .sort_by { |entry| [ -entry[:score], entry[:item].name.to_s ] }
  end

  def score_item_for_slot(item, slot)
    item_tokens = tokens_for(item_text(item))
    slot_tokens = tokens_for(slot_text(slot))
    return 0 if item_tokens.empty? || slot_tokens.empty?

    score = (item_tokens & slot_tokens).length
    score += 3 if role_match?(item, slot)
    score += 2 if subtype_match?(item_tokens, slot)
    score += color_material_feature_score(item_tokens, slot)
    score += preference_adjustment(item, item_tokens)
    score
  end

  def score_item_for_signature(item)
    item_tokens = tokens_for(item_text(item))
    reference_tokens = signature_tokens
    return 0 if item_tokens.empty? || reference_tokens.empty?

    (item_tokens & reference_tokens).length + preference_adjustment(item, item_tokens)
  end

  private

  attr_reader :reference_profile, :preference_context

  def repair_missing_slot_match(selected_ids, candidate_items, candidate_items_by_id, slot, max_items)
    selected_items = selected_ids.filter_map { |item_id| candidate_items_by_id[item_id] }
    selected_best = ranked_items_for_slot(selected_items, slot).first
    return selected_ids if slot_match?(selected_best, slot)

    candidate_best = ranked_items_for_slot(candidate_items, slot).first
    return selected_ids unless slot_match?(candidate_best, slot)
    return selected_ids if selected_ids.include?(candidate_best[:item].id)

    if selected_ids.length < max_items
      [ *selected_ids, candidate_best[:item].id ]
    else
      replace_lowest_optional_item(selected_ids, candidate_best[:item].id, candidate_items_by_id)
    end
  end

  def upgrade_weak_slot_match(selected_ids, candidate_items, candidate_items_by_id, slot)
    selected_items = selected_ids.filter_map { |item_id| candidate_items_by_id[item_id] }
    selected_best = ranked_items_for_slot(selected_items, slot).first
    candidate_best = ranked_items_for_slot(candidate_items, slot).first
    return selected_ids unless slot_match?(selected_best, slot)
    return selected_ids unless slot_match?(candidate_best, slot)
    return selected_ids if selected_ids.include?(candidate_best[:item].id)
    return selected_ids unless candidate_best[:score] >= selected_best[:score] + upgrade_margin(slot)

    selected_ids.map { |item_id| item_id == selected_best[:item].id ? candidate_best[:item].id : item_id }
  end

  def replace_lowest_optional_item(selected_ids, next_item_id, candidate_items_by_id)
    matcher_scores = selected_ids.map do |item_id|
      item = candidate_items_by_id[item_id]
      max_required_score = required_slots.map { |slot| score_item_for_slot(item, slot) }.max || 0
      [ item_id, max_required_score ]
    end

    item_to_replace, score = matcher_scores.min_by { |(_item_id, item_score)| item_score }
    return selected_ids if score && score >= 3

    selected_ids.map do |item_id|
      item_id == item_to_replace ? next_item_id : item_id
    end
  end

  def slot_match?(entry, slot)
    entry.present? && entry[:score] >= slot_match_threshold(slot)
  end

  def slot_match_threshold(slot)
    core_required_role?(slot) ? 3 : 7
  end

  def core_required_role?(slot)
    %w[top bottom dress outerwear shoes].include?(slot_value(slot, "role").to_s.downcase)
  end

  def upgrade_margin(slot)
    core_required_role?(slot) ? 2 : 3
  end

  def role_match?(item, slot)
    role = slot_value(slot, "role").to_s.downcase
    terms = ROLE_TERMS[role] || [ role ].compact_blank
    item_tokens = tokens_for(item_text(item))

    return true if terms.any? { |term| item_tokens.include?(term) }

    case role
    when "top", "outerwear"
      %w[top shirt tee t-shirt blouse sweater sweatshirt hoodie tank camisole cardigan jacket coat blazer vest].include?(item.category.to_s)
    when "bottom"
      %w[bottom jeans shorts skirt pants trouser trousers].include?(item.category.to_s)
    when "bag"
      item.category.to_s == "bag" || item_tokens.any? { |token| ROLE_TERMS["bag"].include?(token) }
    when "shoes"
      item.category.to_s == "shoes"
    when "accessory"
      item.category.to_s == "accessory"
    else
      item.category.to_s == role
    end
  end

  def subtype_match?(item_tokens, slot)
    subtype_tokens = tokens_for(slot_value(slot, "subtype"))
    return false if subtype_tokens.empty?

    (item_tokens & subtype_tokens).any?
  end

  def color_material_feature_score(item_tokens, slot)
    %w[colors materials visual_features].sum do |key|
      tokens = tokens_for(Array(slot_value(slot, key)).join(" "))
      (item_tokens & tokens).length
    end
  end

  def slot_text(slot)
    [
      slot_value(slot, "role"),
      slot_value(slot, "subtype"),
      Array(slot_value(slot, "colors")),
      Array(slot_value(slot, "materials")),
      Array(slot_value(slot, "visual_features"))
    ].flatten.compact.join(" ")
  end

  def signature_tokens
    @signature_tokens ||= tokens_for(
      [
        Array(profile_value("overall_style")),
        target_slots.flat_map { |slot| Array(slot_value(slot, "colors")) },
        target_slots.flat_map { |slot| Array(slot_value(slot, "materials")) },
        target_slots.flat_map { |slot| Array(slot_value(slot, "visual_features")) }
      ].flatten.compact.join(" ")
    )
  end

  def item_text(item)
    ([ item.name, item.category, item.brand, item.style_notes ] + TagListNormalizer.call(item.tags)).join(" ")
  end

  def preference_adjustment(item, item_tokens)
    adjustment = 0
    item_id = item.id.to_i

    adjustment += 2 if preferred_item_ids.include?(item_id)
    adjustment -= 1 if avoided_item_ids.include?(item_id)
    adjustment += [ (item_tokens & preferred_terms).length, 2 ].min
    adjustment -= [ (item_tokens & avoided_terms).length, 1 ].min
    adjustment
  end

  def preferred_item_ids
    @preferred_item_ids ||= Array(preference_value("preferred_item_ids")).map(&:to_i)
  end

  def avoided_item_ids
    @avoided_item_ids ||= Array(preference_value("avoided_item_ids")).map(&:to_i)
  end

  def preferred_terms
    @preferred_terms ||= tokens_for(Array(preference_value("preferred_terms")).join(" "))
  end

  def avoided_terms
    @avoided_terms ||= tokens_for(Array(preference_value("avoided_terms")).join(" "))
  end

  def tokens_for(value)
    value.to_s
      .downcase
      .scan(/[a-z0-9]+/)
      .reject { |token| STOP_WORDS.include?(token) || token.length <= 1 }
      .uniq
  end

  def profile_value(key)
    reference_profile[key] || reference_profile[key.to_sym]
  end

  def preference_value(key)
    preference_context[key] || preference_context[key.to_sym]
  end

  def slot_value(slot, key)
    slot[key] || slot[key.to_sym]
  end

  def truthy?(value)
    value == true || value.to_s == "true"
  end
end
