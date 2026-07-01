require "test_helper"

class OpenrouterOutfitCandidateSelectorTest < ActiveSupport::TestCase
  setup do
    @item = clothing_items(:one)
  end

  test "normalizes valid structured candidate response" do
    item_id = @item.id
    selector = OpenrouterOutfitCandidateSelector.new(items: [ @item ], occasion: "dinner")
    selector.define_singleton_method(:perform_structured_request) do
      {
        "candidate_item_ids" => [ item_id, item_id, "invalid", 123_456 ]
      }
    end

    with_openrouter_key do
      assert_equal [ item_id ], selector.call
    end
  end

  test "raises when structured response has no valid candidate items" do
    selector = OpenrouterOutfitCandidateSelector.new(items: [ @item ])
    selector.define_singleton_method(:perform_structured_request) do
      {
        "candidate_item_ids" => [ 123_456 ]
      }
    end

    with_openrouter_key do
      error = assert_raises(RuntimeError) { selector.call }
      assert_equal "OpenRouter did not select any valid candidate items.", error.message
    end
  end

  test "raises when JSON content cannot be parsed" do
    selector = OpenrouterOutfitCandidateSelector.new(items: [ @item ])

    error = assert_raises(RuntimeError) do
      selector.send(:parse_json_payload, "not-json")
    end

    assert_equal "OpenRouter returned data that was not valid JSON.", error.message
  end

  test "builds compact text-only closet context" do
    @item.update!(
      tags: %w[
        ivory silk blouse work polished office layering neutral classic fitted button-front
        collared long-sleeve
      ],
      style_notes: "Pair this with tailored trousers for a clean office outfit. " * 12
    )
    selector = OpenrouterOutfitCandidateSelector.new(items: [ @item ], occasion: "work")

    content = selector.send(:request_content)
    serialized = content.to_json

    assert_equal [ "text", "text" ], content.map { |part| part[:type] }
    assert_not_includes serialized, "image_url"
    assert_includes serialized, "Closet items:"
    assert_includes serialized, "For dress-based looks, include viable footwear candidates"
    assert_includes serialized, "If the closet includes a bag-like accessory, prefer including a viable bag candidate"
    assert_includes serialized, "Item #{@item.id}:"
    assert_includes serialized, "- tags: ivory, silk, blouse, work, polished, office, layering, neutral, classic, fitted"
    assert_operator serialized.length, :<, 2_800
  end

  test "includes an uploaded flatlay reference image when provided" do
    selector = OpenrouterOutfitCandidateSelector.new(
      items: [ @item ],
      occasion: "match this outfit",
      reference_photo: reference_photo_upload,
      reference_profile: reference_profile_fixture
    )

    content = selector.send(:request_content)
    serialized = content.to_json

    assert_includes content.map { |part| part[:type] }, "image_url"
    assert_includes serialized, "Reference flatlay outfit image"
    assert_includes serialized, "data:image/png;base64,"
    assert_includes serialized, "Structured reference target"
    assert_includes serialized, "chain shoulder bag"
    assert_includes serialized, "prioritize closet items that look closest to the reference outfit"
  end

  test "includes user feedback preference context when provided" do
    selector = OpenrouterOutfitCandidateSelector.new(
      items: [ @item ],
      occasion: "match this outfit",
      preference_context: {
        "preferred_item_ids" => [ @item.id ],
        "preferred_terms" => %w[cream chain],
        "examples" => [ "User edited an AI outfit by adding a chain bag." ]
      }
    )

    serialized = selector.send(:request_content).to_json

    assert_includes serialized, "User generation feedback history"
    assert_includes serialized, "preferred_item_ids"
    assert_includes serialized, "User edited an AI outfit"
  end

  private

  def reference_photo_upload
    Rack::Test::UploadedFile.new(Rails.root.join("test/fixtures/files/item-photo.png"), "image/png")
  end

  def reference_profile_fixture
    {
      "overall_style" => [ "casual glam" ],
      "target_slots" => [
        {
          "role" => "bag",
          "required" => true,
          "subtype" => "chain shoulder bag",
          "colors" => [ "silver" ],
          "materials" => [ "metallic" ],
          "visual_features" => [ "chain strap" ],
          "weight" => 0.9
        }
      ]
    }
  end

  def with_openrouter_key
    original = ENV["OPENROUTER_API_KEY"]
    ENV["OPENROUTER_API_KEY"] = "test-key"
    yield
  ensure
    ENV["OPENROUTER_API_KEY"] = original
  end
end
