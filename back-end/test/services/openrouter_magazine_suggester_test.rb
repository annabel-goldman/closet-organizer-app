require "test_helper"

class OpenrouterMagazineSuggesterTest < ActiveSupport::TestCase
  test "schema requests a concept and ordered saved outfit ids" do
    schema = suggester.send(:response_schema)

    assert_equal %w[name notes outfit_ids], schema.fetch(:required)
    assert_equal OpenrouterMagazineSuggester::MAX_SELECTED_OUTFITS,
      schema.dig(:properties, :outfit_ids, :maxItems)
    assert_equal false, schema[:additionalProperties]
  end

  test "prompt treats existing details as a creative brief and includes outfit pieces" do
    prompt = suggester.send(:suggestion_prompt)

    assert_includes prompt, "creative brief"
    assert_includes prompt, "Paris After Dark"
    assert_includes prompt, outfits(:one).name
    assert_includes prompt, clothing_items(:one).name
    assert_includes prompt, "ordered as a satisfying magazine sequence"
  end

  test "filters duplicate and invented outfit ids while preserving order" do
    service = suggester
    valid_id = outfits(:one).id

    assert_equal [ valid_id ], service.send(:normalized_outfit_ids, [ valid_id, valid_id, "invalid", 999_999 ])
  end

  private

  def suggester
    OpenrouterMagazineSuggester.new(
      outfits: [ outfits(:one) ],
      current_metadata: {
        name: "Paris After Dark",
        notes: "Dinner and gallery looks",
        outfit_ids: [ outfits(:one).id ]
      }
    )
  end
end
