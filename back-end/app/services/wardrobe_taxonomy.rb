module WardrobeTaxonomy
  CANONICAL_CATEGORIES = %w[
    top
    bottom
    dress
    outerwear
    shoes
    bag
    intimates
  ].freeze

  CATEGORY_ALIASES = {
    "top" => "top",
    "shirt" => "top",
    "t-shirt" => "top",
    "tshirt" => "top",
    "tee" => "top",
    "sweater" => "top",
    "sweatshirt" => "top",
    "tank top" => "top",
    "tank" => "top",
    "blouse" => "top",
    "hoodie" => "top",
    "cardigan" => "top",
    "camisole" => "top",
    "cami" => "top",
    "vest" => "top",
    "bottom" => "bottom",
    "bottoms" => "bottom",
    "pants" => "bottom",
    "shorts" => "bottom",
    "short" => "bottom",
    "skirt" => "bottom",
    "jeans" => "bottom",
    "dress" => "dress",
    "outerwear" => "outerwear",
    "jacket" => "outerwear",
    "coat" => "outerwear",
    "blazer" => "outerwear",
    "peacoat" => "outerwear",
    "shoes" => "shoes",
    "shoe" => "shoes",
    "boots" => "shoes",
    "boot" => "shoes",
    "sandals" => "shoes",
    "sandal" => "shoes",
    "flats" => "shoes",
    "flat" => "shoes",
    "sneakers" => "shoes",
    "sneaker" => "shoes",
    "heels" => "shoes",
    "heel" => "shoes",
    "pumps" => "shoes",
    "slippers" => "shoes",
    "bag" => "bag",
    "bags" => "bag",
    "handbag" => "bag",
    "tote" => "bag",
    "crossbody" => "bag",
    "shoulder bag" => "bag",
    "intimates" => "intimates",
    "intimate" => "intimates",
    "bra" => "intimates",
    "bralette" => "intimates",
    "bikini" => "intimates",
    "swimwear" => "intimates",
    "lingerie" => "intimates",
    "underwear" => "intimates"
  }.freeze

  SUBTYPE_TAGS = {
    "shirt" => "shirt",
    "t-shirt" => "shirt",
    "tshirt" => "shirt",
    "tee" => "shirt",
    "sweater" => "sweater",
    "sweatshirt" => "sweater",
    "tank top" => "tank top",
    "tank" => "tank top",
    "blouse" => "blouse",
    "hoodie" => "hoodie",
    "cardigan" => "cardigan",
    "camisole" => "camisole",
    "cami" => "camisole",
    "vest" => "vest",
    "pants" => "pants",
    "shorts" => "shorts",
    "short" => "shorts",
    "skirt" => "skirt",
    "jeans" => "jeans",
    "jacket" => "jacket",
    "coat" => "coat",
    "blazer" => "blazer",
    "peacoat" => "coat",
    "boots" => "boots",
    "boot" => "boots",
    "sandals" => "sandals",
    "sandal" => "sandals",
    "flats" => "flats",
    "flat" => "flats",
    "sneakers" => "sneakers",
    "sneaker" => "sneakers",
    "heels" => "heels",
    "heel" => "heels",
    "pumps" => "heels",
    "slippers" => "slippers",
    "bra" => "bra",
    "bralette" => "bra",
    "bikini" => "bikini",
    "swimwear" => "swimwear",
    "lingerie" => "lingerie",
    "underwear" => "underwear"
  }.freeze

  TAG_ALIASES = {
    "crewneck" => "crew neck",
    "wide leg" => "wide-leg",
    "long sleeves" => "long sleeve",
    "long-sleeve" => "long sleeve",
    "short sleeves" => "short sleeve",
    "low top" => "low-top",
    "mid rise" => "mid-rise",
    "high waist" => "high-waisted",
    "high-waist" => "high-waisted",
    "tshirt" => "shirt",
    "t-shirt" => "shirt",
    "tee" => "shirt",
    "bottoms" => "bottom",
    "button front" => "button-front",
    "button up" => "button-up"
  }.freeze

  BRAND_ALIASES = {
    "j-crew" => "J.Crew",
    "j.crew" => "J.Crew",
    "arie" => "Aerie",
    "billa bong" => "Billabong",
    "club monoco" => "Club Monaco",
    "vinyard vines" => "Vineyard Vines",
    "champion" => "Champion"
  }.freeze

  NAME_ALIASES = {
    "Black Shorts with Pink Skeleton Hands" => "Black Sports Bra with Pink Skeleton Hands",
    "Navy Knit Polo Aweater" => "Navy Knit Polo Sweater"
  }.freeze

  REDUNDANT_TAGS_BY_CATEGORY = {
    "top" => %w[top],
    "bottom" => %w[bottom bottoms],
    "dress" => %w[dress],
    "outerwear" => %w[outerwear],
    "shoes" => %w[shoes shoe],
    "bag" => %w[bag bags],
    "intimates" => %w[intimates intimate]
  }.freeze

  NAME_CATEGORY_PATTERNS = [
    [ /\b(bra|bralette)\b/, "intimates" ],
    [ /\bbikini\b|\bswimwear\b/, "intimates" ],
    [ /\bbag\b|\btote\b|\bcrossbody\b|\bhandbag\b/, "bag" ],
    [ /\b(boot|boots|shoe|shoes|sandal|sandals|flat|flats|sneaker|sneakers|heel|heels|pump|pumps|slipper|slippers|mary janes?)\b/, "shoes" ],
    [ /\bdress\b/, "dress" ],
    [ /\b(jacket|coat|blazer|peacoat)\b/, "outerwear" ],
    [ /\b(pants|shorts|skirt|jeans)\b/, "bottom" ],
    [ /\b(shirt|t-shirt|tee|sweater|sweatshirt|tank|top|camisole|cami|blouse|hoodie|cardigan|vest)\b/, "top" ]
  ].freeze

  NAME_SUBTYPE_PATTERNS = [
    [ /\b(sweater|sweatshirt)\b/, "sweater" ],
    [ /\b(t-shirt|shirt|tee)\b/, "shirt" ],
    [ /\btank\b|\btank top\b/, "tank top" ],
    [ /\b(blouse)\b/, "blouse" ],
    [ /\b(hoodie)\b/, "hoodie" ],
    [ /\b(cardigan)\b/, "cardigan" ],
    [ /\b(camisole|cami)\b/, "camisole" ],
    [ /\b(pants)\b/, "pants" ],
    [ /\b(shorts)\b/, "shorts" ],
    [ /\b(skirt)\b/, "skirt" ],
    [ /\b(jeans)\b/, "jeans" ],
    [ /\b(jacket)\b/, "jacket" ],
    [ /\b(coat|peacoat)\b/, "coat" ],
    [ /\b(blazer)\b/, "blazer" ],
    [ /\b(boots?)\b/, "boots" ],
    [ /\b(sandals?)\b/, "sandals" ],
    [ /\b(flats?)\b/, "flats" ],
    [ /\b(sneakers?)\b/, "sneakers" ],
    [ /\b(heels?|pumps?)\b/, "heels" ],
    [ /\b(slippers?)\b/, "slippers" ],
    [ /\b(bra|bralette)\b/, "bra" ],
    [ /\b(bikini)\b/, "bikini" ]
  ].freeze

  module_function

  def normalize_category(value, name: nil)
    normalized = normalize_token(value)
    return CATEGORY_ALIASES.fetch(normalized) if CATEGORY_ALIASES.key?(normalized)

    inferred = infer_category_from_name(name)
    return inferred if normalized.blank? && inferred.present?

    normalized.presence
  end

  def canonical_category?(value)
    CANONICAL_CATEGORIES.include?(normalize_token(value))
  end

  def subtype_tag_for_category(value, canonical_category: normalize_category(value))
    normalized = normalize_token(value)
    subtype = SUBTYPE_TAGS[normalized]
    return if subtype.blank? || subtype == canonical_category

    subtype
  end

  def normalize_tags(raw_tags, category: nil, extra_tags: [])
    normalized_category = normalize_category(category)
    redundant_tags = REDUNDANT_TAGS_BY_CATEGORY.fetch(normalized_category, [])

    TagListNormalizer.call(TagListNormalizer.call(raw_tags) + Array(extra_tags))
      .map { |tag| normalize_tag(tag) }
      .compact_blank
      .reject { |tag| redundant_tags.include?(tag) }
      .uniq
  end

  def normalize_brand(value)
    trimmed = value.to_s.strip
    return nil if trimmed.blank?

    BRAND_ALIASES.fetch(trimmed.downcase, trimmed)
  end

  def normalize_item_name(value)
    NAME_ALIASES.fetch(value.to_s.strip, value.to_s.strip)
  end

  def infer_category_from_name(name)
    normalized_name = normalize_token(name)
    return if normalized_name.blank?

    NAME_CATEGORY_PATTERNS.each do |pattern, category|
      return category if normalized_name.match?(pattern)
    end

    nil
  end

  def infer_subtype_from_name(name)
    normalized_name = normalize_token(name)
    return if normalized_name.blank?

    NAME_SUBTYPE_PATTERNS.each do |pattern, subtype|
      return subtype if normalized_name.match?(pattern)
    end

    nil
  end

  def infer_subtype_from_name_for_category(name, canonical_category)
    inferred_category = infer_category_from_name(name)
    return unless inferred_category == canonical_category

    infer_subtype_from_name(name)
  end

  def normalize_tag(value)
    normalized = normalize_token(value)
    TAG_ALIASES.fetch(normalized, normalized)
  end

  def normalize_token(value)
    value.to_s.strip.downcase.gsub(/[[:space:]]+/, " ")
  end
end
