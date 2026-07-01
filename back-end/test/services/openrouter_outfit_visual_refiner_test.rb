require "test_helper"

class OpenrouterOutfitVisualRefinerTest < ActiveSupport::TestCase
  setup do
    @item = clothing_items(:one)
  end

  test "normalizes a valid structured outfit response" do
    item_id = @item.id
    refiner = OpenrouterOutfitVisualRefiner.new(items: [ @item ], occasion: "dinner")
    refiner.define_singleton_method(:perform_structured_request) do
      {
        "name" => "Dinner Look",
        "tags" => [ "Dinner", "polished" ],
        "notes" => "Wear the blouse as the focal point.",
        "item_ids" => [ item_id ]
      }
    end

    with_openrouter_key do
      result = refiner.call

      assert_equal "Dinner Look", result[:name]
      assert_equal [ "dinner", "polished" ], result[:tags]
      assert_equal "Wear the blouse as the focal point.", result[:notes]
      assert_equal [ item_id ], result[:item_ids]
    end
  end

  test "raises when structured response has no valid selected items" do
    refiner = OpenrouterOutfitVisualRefiner.new(items: [ @item ])
    refiner.define_singleton_method(:perform_structured_request) do
      {
        "name" => "Empty Look",
        "tags" => [],
        "notes" => "",
        "item_ids" => []
      }
    end

    with_openrouter_key do
      error = assert_raises(RuntimeError) { refiner.call }
      assert_equal "OpenRouter did not select any valid closet items.", error.message
    end
  end

  test "raises when JSON content cannot be parsed" do
    refiner = OpenrouterOutfitVisualRefiner.new(items: [ @item ])

    error = assert_raises(RuntimeError) do
      refiner.send(:parse_json_payload, "not-json")
    end

    assert_equal "OpenRouter returned data that was not valid JSON.", error.message
  end

  test "includes photos only for candidate items with display photos" do
    attach_item_photo(@item)
    refiner = OpenrouterOutfitVisualRefiner.new(items: [ @item ], occasion: "work")

    content = refiner.send(:request_content)
    serialized = content.to_json

    assert_includes content.map { |part| part[:type] }, "image_url"
    assert_includes serialized, "Candidate closet items:"
    assert_includes serialized, "Build a complete wearable look"
    assert_includes serialized, "Photo for item #{@item.id}"
    assert_includes serialized, "data:image/png;base64,"
  end

  test "accepts a dress look with footwear and an optional bag" do
    dress = create_candidate_item(name: "Gold Sparkly Halter Mini Dress", category: "dress", tags: %w[gold sparkly party dress])
    shoes = create_candidate_item(name: "Gold Bow Strap Sandals", category: "shoes", tags: %w[gold sandals party])
    bag = create_candidate_item(name: "Black Beaded Evening Bag", category: "accessory", tags: %w[black beaded evening bag])
    refiner = OpenrouterOutfitVisualRefiner.new(items: [ dress, shoes, bag ], occasion: "party")
    refiner.define_singleton_method(:perform_structured_request) do
      {
        "name" => "Party Dress Look",
        "tags" => [ "party" ],
        "notes" => "A complete party look.",
        "item_ids" => [ dress.id, shoes.id, bag.id ]
      }
    end

    with_openrouter_key do
      result = refiner.call

      assert_equal [ dress.id, shoes.id, bag.id ], result[:item_ids]
      assert_equal 2, refiner.send(:response_schema).dig(:properties, :item_ids, :minItems)
    end
  end

  test "does not reject a valid dress look when a bag candidate is omitted" do
    dress = create_candidate_item(name: "Gold Sparkly Halter Mini Dress", category: "dress", tags: %w[gold sparkly party dress])
    shoes = create_candidate_item(name: "Gold Bow Strap Sandals", category: "shoes", tags: %w[gold sandals party])
    bag = create_candidate_item(name: "Black Beaded Evening Bag", category: "accessory", tags: %w[black beaded evening bag])
    refiner = OpenrouterOutfitVisualRefiner.new(items: [ dress, shoes, bag ], occasion: "party")
    refiner.define_singleton_method(:perform_structured_request) do
      {
        "name" => "Party Dress Look",
        "tags" => [ "party" ],
        "notes" => "A complete party look without the bag.",
        "item_ids" => [ dress.id, shoes.id ]
      }
    end

    with_openrouter_key do
      result = refiner.call

      assert_equal [ dress.id, shoes.id ], result[:item_ids]
    end
  end

  test "rejects a dress-only selection when footwear candidates are available" do
    dress = create_candidate_item(name: "Gold Sparkly Halter Mini Dress", category: "dress", tags: %w[gold sparkly party dress])
    shoes = create_candidate_item(name: "Gold Bow Strap Sandals", category: "shoes", tags: %w[gold sandals party])
    bag = create_candidate_item(name: "Black Beaded Evening Bag", category: "accessory", tags: %w[black beaded evening bag])
    refiner = OpenrouterOutfitVisualRefiner.new(items: [ dress, shoes, bag ], occasion: "party")
    refiner.define_singleton_method(:perform_structured_request) do
      {
        "name" => "Dress Only",
        "tags" => [ "party" ],
        "notes" => "Too sparse.",
        "item_ids" => [ dress.id ]
      }
    end

    with_openrouter_key do
      error = assert_raises(RuntimeError) { refiner.call }

      assert_equal "OpenRouter selected 1 item(s), but this candidate set requires at least 2 for a complete outfit.", error.message
    end
  end

  test "caps candidate photos while keeping all candidate metadata" do
    items = (OpenrouterOutfitVisualRefiner::MAX_CONTEXT_PHOTOS + 2).times.map do |index|
      ClothingItem.create!(
        user: @item.user,
        name: "Photo Item #{index}",
        category: "shirt",
        size: :medium
      ).tap { |item| attach_item_photo(item) }
    end
    refiner = OpenrouterOutfitVisualRefiner.new(items: items, occasion: "travel")

    content = refiner.send(:request_content)
    serialized = content.to_json

    assert_equal OpenrouterOutfitVisualRefiner::MAX_CONTEXT_PHOTOS, content.count { |part| part[:type] == "image_url" }
    assert_includes serialized, "Item #{items.last.id}:"
    assert_not_includes serialized, "Photo for item #{items.last.id}"
  end

  test "falls back to text-only refinement when candidate photos are unavailable" do
    refiner = OpenrouterOutfitVisualRefiner.new(items: [ @item ], occasion: "work")

    content = refiner.send(:request_content)
    serialized = content.to_json

    assert_equal [ "text", "text" ], content.map { |part| part[:type] }
    assert_not_includes serialized, "image_url"
    assert_includes serialized, "No candidate photos are available"
  end

  test "includes an uploaded flatlay reference image when provided" do
    refiner = OpenrouterOutfitVisualRefiner.new(
      items: [ @item ],
      occasion: "match this outfit",
      reference_photo: reference_photo_upload,
      reference_profile: reference_profile_fixture
    )

    content = refiner.send(:request_content)
    serialized = content.to_json

    assert_includes content.map { |part| part[:type] }, "image_url"
    assert_includes serialized, "Reference flatlay outfit image"
    assert_includes serialized, "Structured reference target"
    assert_includes serialized, "chain shoulder bag"
    assert_includes serialized, "data:image/png;base64,"
    assert_includes serialized, "recreate the outfit's overall vibe"
    assert_equal "Generated from the uploaded flatlay reference and closet item context.", refiner.send(:generated_notes_fallback)
  end

  test "includes user feedback preference context when provided" do
    refiner = OpenrouterOutfitVisualRefiner.new(
      items: [ @item ],
      occasion: "match this outfit",
      preference_context: {
        "preferred_item_ids" => [ @item.id ],
        "preferred_terms" => %w[cream chain],
        "examples" => [ "User saved an AI outfit unchanged with a cream skirt." ]
      }
    )

    serialized = refiner.send(:request_content).to_json

    assert_includes serialized, "User generation feedback history"
    assert_includes serialized, "preferred_item_ids"
    assert_includes serialized, "User saved an AI outfit unchanged"
  end

  test "repairs final selection to include missing required reference slot matches" do
    hoodie = create_candidate_item(
      name: "Olive Wing Graphic Hoodie",
      category: "top",
      tags: %w[olive hoodie wing graphic]
    )
    shorts = create_candidate_item(
      name: "White Denim Distressed Shorts",
      category: "bottom",
      tags: %w[white denim distressed shorts]
    )
    bag = create_candidate_item(
      name: "Silver Chain Shoulder Bag",
      category: "bag",
      tags: %w[silver chain purse]
    )
    refiner = OpenrouterOutfitVisualRefiner.new(
      items: [ hoodie, shorts, bag ],
      occasion: "match this",
      reference_profile: reference_profile_fixture
    )
    refiner.define_singleton_method(:perform_structured_request) do
      {
        "name" => "Reference Match",
        "tags" => [ "reference" ],
        "notes" => "A close match.",
        "item_ids" => [ hoodie.id, shorts.id ]
      }
    end

    with_openrouter_key do
      result = refiner.call

      assert_includes result[:item_ids], bag.id
    end
  end

  private

  def reference_photo_upload
    Rack::Test::UploadedFile.new(Rails.root.join("test/fixtures/files/item-photo.png"), "image/png")
  end

  def create_candidate_item(name:, category:, tags:)
    ClothingItem.create!(
      user: @item.user,
      name: name,
      category: category,
      tags: tags,
      size: :na
    )
  end

  def attach_item_photo(item)
    File.open(Rails.root.join("test/fixtures/files/item-photo.png"), "rb") do |file|
      item.photo.attach(
        io: file,
        filename: "item-photo.png",
        content_type: "image/png"
      )
    end
  end

  def with_openrouter_key
    original = ENV["OPENROUTER_API_KEY"]
    ENV["OPENROUTER_API_KEY"] = "test-key"
    yield
  ensure
    ENV["OPENROUTER_API_KEY"] = original
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
end
