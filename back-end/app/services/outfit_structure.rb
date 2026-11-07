# Deterministic clothing coverage and role checks, independent of aesthetic scores.
class OutfitStructure
  ACCESSORY_FAMILIES = {
    "hat" => /\b(hat|beanie|beret|cap|headwear|fedora)\b/i,
    "bag" => /\b(bag|handbag|purse|clutch|tote|backpack)\b/i,
    "belt" => /\bbelts?\b/i,
    "scarf" => /\b(scarf|scarves|shawl)\b/i,
    "earrings" => /\bearrings?\b/i,
    "necklace" => /\b(necklace|pendant)\b/i,
    "bracelet" => /\bbracelets?\b/i,
    "ring" => /\brings?\b/i,
    "watch" => /\bwatch(?:es)?\b/i,
    "jewelry" => /\b(jewelry|jewellery|earrings?|necklace|bracelet|ring|pendant|watch)\b/i,
    "eyewear" => /\b(sunglasses|glasses|eyewear)\b/i,
    "gloves" => /\b(gloves?|mittens?)\b/i
  }.freeze

  def self.roles(brief)
    roles = Array(brief["garment_roles"]).map(&:dup)
    if roles.empty?
      roles = Array(brief["required_categories"]).map { |category| role(category) } +
        Array(brief["optional_categories"]).map { |category| role(category).merge("required" => false) }
    end
    anchor = brief["anchor"] || {}
    if anchor["category"].present?
      existing = roles.find { |entry| entry["category"] == anchor["category"] }
      if existing
        existing["required"] = true
        existing["description"] = [ existing["description"], anchor["description"] ].compact.uniq.join("; ")
      else
        roles.unshift(role(anchor["category"]).merge("description" => anchor["description"]))
      end
    end
    categories = roles.select { |entry| entry["required"] != false }.pluck("category")
    unless categories.include?("dress") || categories.include?("swimwear")
      %w[top bottom].each { |category| roles << role(category) unless categories.include?(category) }
    end
    roles << role("shoes") unless roles.any? { |entry| entry["category"] == "shoes" }
    roles.each_with_index { |entry, index| entry["role_id"] = "role_#{index}" }
    roles
  end

  def self.role(category)
    { "name" => category, "category" => category, "required" => true, "layer" => 1, "description" => category }
  end

  def self.matches?(item, role)
    return false unless item.category == role["category"]
    return true unless role["category"] == "accessory"

    requested = [ role["name"], role["description"] ].join(" ")
    family = ACCESSORY_FAMILIES.values.find { |pattern| requested.match?(pattern) }
    return item_text(item).match?(family) if family

    # Unknown specific roles must not silently accept every accessory (e.g. a
    # handbag is not a prop). Generic accessory roles deliberately remain broad.
    name = role["name"].to_s.downcase.squish
    return true if name.blank? || %w[accessory accessories].include?(name)

    item_text(item).match?(/\b#{Regexp.escape(name)}\b/i)
  end

  def self.item_text(item)
    [ item.name, item.style_notes, item.tags, item.wardrobe_item_analysis&.extracted_attributes ].join(" ")
  end

  def self.covered?(items)
    categories = items.map(&:category)
    body = categories.include?("dress") || (%w[top bottom] - categories).empty?
    # A bikini top alone is not a complete swimsuit.
    swims = items.select { |item| item.category == "swimwear" }
    swim_coverage = swims.any? { |item| item_text(item).match?(/one.piece|swimsuit|bikini set|swim shorts|swim trunks/i) } ||
      (swims.any? { |item| item_text(item).match?(/top/i) } && swims.any? { |item| item_text(item).match?(/bottom/i) })
    (body || swim_coverage) && categories.include?("shoes")
  end

  def self.valid?(items, brief:, user_id: nil, locked_ids: [], excluded_ids: [])
    return false unless eligible?(items, brief: brief, user_id: user_id, locked_ids: locked_ids, excluded_ids: excluded_ids)
    return false unless covered?(items)

    missing_roles(items, brief).empty?
  end

  # Coverage and inferred roles are advice, never eligibility gates.
  def self.eligible?(items, brief:, user_id: nil, locked_ids: [], excluded_ids: [])
    return false if items.empty?
    ids = items.map(&:id)
    return false unless ids.uniq == ids && (locked_ids - ids).empty? && (excluded_ids & ids).empty?
    return false if user_id && items.any? { |item| item.user_id != user_id }
    !OutfitRecommendationScorer.new(brief: brief, query_embedding: []).hard_violation?(items)
  end

  def self.missing_roles(items, brief)
    unused = items.dup
    roles(brief).select { |role| role["required"] != false }.sort_by { |role| items.count { |item| matches?(item, role) } }.filter_map do |role|
      match = unused.find { |item| matches?(item, role) }
      unused.delete(match) if match
      role["name"].presence || role["category"] unless match
    end
  end

  def self.limitations(items, brief)
    notes = Array(brief["compromises"]).dup
    notes << "This is an incomplete outfit; some clothing coverage or footwear is missing." unless covered?(items)
    missing = missing_roles(items, brief)
    notes << "Not included from the suggested plan: #{missing.to_sentence}." if missing.any?
    notes.uniq
  end
end
