require "test_helper"

class OpenrouterMetadataSuggesterTest < ActiveSupport::TestCase
  test "response schema restricts category to allowed closet types" do
    schema = suggester.send(:response_schema)

    assert_equal OpenrouterMetadataSuggester::ALLOWED_CATEGORIES, schema.dig(:properties, :category, :enum)
  end

  test "prompt tells the model to use only allowed broad category types" do
    prompt = suggester.send(:suggestion_prompt)

    assert_includes prompt, "category: exactly one of top, bottom, shoes, accessory, dress, outerwear, intimates, swimwear"
    assert_includes prompt, "Put more specific item types like blouse, sweater, skirt, jeans, boots, bra, bag, or camisole in tags instead of category."
    assert_includes prompt, "The name must start with the dominant color or color family for alphabetical sorting."
    assert_includes prompt, "Use title case for names"
  end

  test "normalizes specific clothing types to broad closet categories" do
    service = suggester

    assert_equal "top", service.send(:normalize_category, "Blouse")
    assert_equal "top", service.send(:normalize_category, "sweater")
    assert_equal "bottom", service.send(:normalize_category, "jeans")
    assert_equal "bottom", service.send(:normalize_category, "skirt")
    assert_equal "outerwear", service.send(:normalize_category, "jacket")
    assert_equal "shoes", service.send(:normalize_category, "boots")
    assert_equal "accessory", service.send(:normalize_category, "handbag")
    assert_equal "accessory", service.send(:normalize_category, "bag")
    assert_equal "intimates", service.send(:normalize_category, "bra")
    assert_equal "swimwear", service.send(:normalize_category, "bikini")
    assert_equal "swimwear", service.send(:normalize_category, "swimsuit")
  end

  test "rejects unknown categories instead of creating new closet types" do
    assert_nil suggester.send(:normalize_category, "costume")
  end

  test "normalizes item names so the first color appears first" do
    service = suggester

    assert_equal "Red Bright Patent Shoulder Bag", service.send(:normalized_name, "Bright Red Patent Shoulder Bag")
    assert_equal "Blue Light Wide-Leg Jeans", service.send(:normalized_name, "Light Blue Wide-Leg Jeans")
    assert_equal "Ivory Silk Blouse", service.send(:normalized_name, "Ivory Silk Blouse")
    assert_equal "Green Vintage Cardigan", service.send(:normalized_name, "Vintage Green Cardigan")
  end

  test "normalizes item names to title case with lowercase connector words" do
    service = suggester

    assert_equal "Red Bright Patent Shoulder Bag", service.send(:normalized_name, "red bright patent shoulder bag")
    assert_equal "Black Top with Pearl Trim", service.send(:normalized_name, "black top with pearl trim")
    assert_equal "White Button-Up Shirt", service.send(:normalized_name, "white button-up shirt")
    assert_equal "Blue Wide-Leg Trousers", service.send(:normalized_name, "blue wide-leg trousers")
  end

  private

  def suggester
    OpenrouterMetadataSuggester.new(nil)
  end
end
