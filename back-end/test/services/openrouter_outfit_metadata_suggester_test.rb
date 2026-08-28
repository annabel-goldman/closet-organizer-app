require "test_helper"

class OpenrouterOutfitMetadataSuggesterTest < ActiveSupport::TestCase
  test "schema requests outfit title tags and notes" do
    schema = suggester.send(:response_schema)

    assert_equal %w[name tags notes], schema.fetch(:required)
    assert_equal 8, schema.dig(:properties, :tags, :maxItems)
    assert_equal false, schema[:additionalProperties]
  end

  test "prompt grounds suggestions in included pieces and current draft details" do
    prompt = suggester.send(:suggestion_prompt)

    assert_includes prompt, "using only the included closet pieces"
    assert_includes prompt, "Weekend Placeholder"
    assert_includes prompt, clothing_items(:one).name
    assert_includes prompt, "Do not invent garments, brands, colors, or details"
  end

  test "normalizes generated details to outfit limits" do
    service = suggester

    assert_operator service.send(:normalized_name, "  Gallery   Evening  ").length, :<=, InputLengthPolicy::MAX_OUTFIT_NAME
    assert_equal "Gallery Evening", service.send(:normalized_name, "  Gallery   Evening  ")
    assert_equal "A polished evening look.", service.send(:normalized_notes, "  A polished   evening look.  ")
    assert_equal [ "gallery", "a" * 37 + "..." ], service.send(:normalized_tags, [ "Gallery", "A" * 50 ])
  end

  private

  def suggester
    OpenrouterOutfitMetadataSuggester.new(
      items: [ clothing_items(:one) ],
      current_metadata: {
        name: "Weekend Placeholder",
        tags: [ "casual" ],
        notes: "Current draft"
      }
    )
  end
end
