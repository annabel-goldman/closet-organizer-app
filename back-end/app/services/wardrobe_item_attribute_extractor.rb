class WardrobeItemAttributeExtractor
  MATERIALS = %w[
    canvas cashmere chiffon corduroy cotton crochet denim faux-leather fur lace leather linen mesh
    nylon polyester satin sequins silk suede tweed velvet wool knit ribbed
  ].freeze
  PATTERNS = %w[
    animal-print beaded checkered colorblock floral graphic houndstooth paisley plaid polka-dot
    solid striped tie-dye
  ].freeze
  STYLES = %w[
    athletic bohemian casual classic edgy elegant grunge minimalist preppy romantic streetwear
    western y2k vintage
  ].freeze
  SEASONS = %w[spring summer fall autumn winter].freeze
  FORMALITY_TERMS = {
    1 => %w[athletic beach casual lounge sporty swimwear],
    2 => %w[daytime everyday relaxed weekend],
    3 => %w[brunch date polished smart-casual work],
    4 => %w[cocktail elegant evening formal party],
    5 => %w[black-tie gala]
  }.freeze

  def self.call(item)
    new(item).call
  end

  def initialize(item)
    @item = item
  end

  def call
    {
      "category" => item.category,
      "materials" => matching_terms(MATERIALS),
      "patterns" => matching_terms(PATTERNS),
      "styles" => matching_terms(STYLES),
      "seasons" => matching_terms(SEASONS).map { |term| term == "autumn" ? "fall" : term }.uniq,
      "formality" => inferred_formality
    }
  end

  private

  attr_reader :item

  def searchable_text
    @searchable_text ||= [ item.name, item.brand, item.category, item.style_notes, *TagListNormalizer.call(item.tags) ]
      .compact
      .join(" ")
      .downcase
      .tr("_", "-")
  end

  def matching_terms(terms)
    terms.select { |term| searchable_text.match?(/\b#{Regexp.escape(term)}\b/) }
  end

  def inferred_formality
    matches = FORMALITY_TERMS.filter_map do |level, terms|
      level if matching_terms(terms).any?
    end
    matches.max || 2
  end
end
