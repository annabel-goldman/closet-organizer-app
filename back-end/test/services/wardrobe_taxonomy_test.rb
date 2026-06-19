require "test_helper"

class WardrobeTaxonomyTest < ActiveSupport::TestCase
  test "maps category aliases to broad canonical types" do
    assert_equal "top", WardrobeTaxonomy.normalize_category("Sweater")
    assert_equal "bottom", WardrobeTaxonomy.normalize_category("jeans")
    assert_equal "outerwear", WardrobeTaxonomy.normalize_category("blazer")
    assert_equal "shoes", WardrobeTaxonomy.normalize_category("boots")
    assert_equal "intimates", WardrobeTaxonomy.normalize_category("bra")
  end

  test "normalizes tag aliases and removes redundant broad category tags" do
    tags = WardrobeTaxonomy.normalize_tags(
      [ "crewneck", "wide leg", "long sleeves", "top", "sweater" ],
      category: "top"
    )

    assert_equal [ "crew neck", "wide-leg", "long sleeve", "sweater" ], tags
  end

  test "preserves useful subtype tag when category collapses" do
    category = WardrobeTaxonomy.normalize_category("boots")
    subtype = WardrobeTaxonomy.subtype_tag_for_category("boots", canonical_category: category)

    tags = WardrobeTaxonomy.normalize_tags([], category: category, extra_tags: [ subtype ])

    assert_equal "shoes", category
    assert_equal [ "boots" ], tags
  end

  test "normalizes known brand typos" do
    assert_equal "J.Crew", WardrobeTaxonomy.normalize_brand("J-crew")
    assert_equal "Aerie", WardrobeTaxonomy.normalize_brand("Arie")
    assert_equal "Club Monaco", WardrobeTaxonomy.normalize_brand("Club Monoco")
  end
end
