require "test_helper"

class OutfitsFlowTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:one)
    @other_user = users(:two)
    @outfit = outfits(:one)
    @user_item = clothing_items(:one)
    @other_user_item = clothing_items(:two)
  end

  test "outfits index only returns current user outfits" do
    get outfits_url, headers: auth_headers(@user), as: :json

    assert_response :success
    assert_equal [ @outfit.id ], response_json.map { |outfit| outfit["id"] }
    assert_equal [ @user_item.id ], response_json.first["item_ids"]
  end

  test "outfit show loads for current user" do
    get outfit_url(@outfit), headers: auth_headers(@user), as: :json

    assert_response :success
    assert_equal @outfit.name, response_json["name"]
    assert_equal @user_item.id, response_json["items"].first["id"]
  end

  test "can create an outfit with owned items" do
    assert_difference("Outfit.count", 1) do
      post outfits_url, params: {
        outfit: {
          name: "Rainy Day Fit",
          tags: [ "rain", "casual" ],
          notes: "Layers and waterproof shoes.",
          item_ids: [ @user_item.id ]
        }
      }, headers: auth_headers(@user), as: :json
    end

    assert_response :created

    created_outfit = Outfit.order(:created_at).last
    assert_equal @user.id, created_outfit.user_id
    assert_equal [ @user_item.id ], created_outfit.clothing_item_ids
    assert_equal [ "rain", "casual" ], response_json["tags"]
    assert_equal [ @user_item.id ], response_json["item_ids"]
  end

  test "can generate an outfit with owned closet items" do
    captured = {}
    reference_photo = Rack::Test::UploadedFile.new(file_fixture("item-photo.png"), "image/png")

    with_outfit_generator_stub(
      capture: captured,
      result: {
        name: "Gallery Afternoon",
        tags: [ "gallery", "polished" ],
        notes: "The blouse anchors a polished afternoon look.",
        item_ids: [ @user_item.id ]
      }
    ) do
      assert_difference("Outfit.count", 1) do
        assert_difference("OutfitGenerationRun.count", 1) do
          assert_difference("OutfitGenerationEvent.count", 2) do
            post generate_outfits_url, params: {
              occasion: "gallery afternoon",
              reference_photo: reference_photo
            }, headers: auth_headers(@user)
          end
        end
      end
    end

    assert_response :created
    assert_equal "Gallery Afternoon", response_json["name"]
    assert_equal [ @user_item.id ], response_json["item_ids"]
    assert_equal true, response_json["generated_by_ai"]
    assert_equal [ @user_item.id ], response_json["generated_item_ids"]
    assert_equal OutfitGenerationRun.last.id, response_json["generation_id"]
    assert_equal "gallery afternoon", captured[:occasion]
    assert_equal "image/png", captured[:reference_photo].content_type
    assert_equal [ @user_item.id ], captured[:items].map(&:id)
    assert_equal @user, captured[:user]

    run = OutfitGenerationRun.last
    assert_equal @user, run.user
    assert_equal "gallery afternoon", run.occasion
    assert_equal [ @user_item.id ], run.candidate_item_ids
    assert_equal [ @user_item.id ], run.generated_item_ids
    assert_equal %w[generated opened_for_edit], run.outfit_generation_events.order(:created_at).pluck(:event_type)
  end

  test "outfit generation requires login" do
    post generate_outfits_url, params: { occasion: "casual" }, as: :json

    assert_response :unauthorized
  end

  test "outfit generation rejects empty closets" do
    empty_user = User.create!(
      username: "empty closet",
      provider: "test",
      uid: "empty-closet",
      password: "password"
    )

    assert_no_difference("Outfit.count") do
      post generate_outfits_url, headers: auth_headers(empty_user), as: :json
    end

    assert_response :unprocessable_content
    assert_equal "Add closet items before generating an outfit.", response_json["error"]
  end

  test "outfit generation rejects item ids not owned by the current user" do
    with_outfit_generator_stub(
      result: {
        name: "Invalid Look",
        tags: [ "invalid" ],
        notes: "Should not save.",
        item_ids: [ @other_user_item.id ]
      }
    ) do
      assert_no_difference("Outfit.count") do
        post generate_outfits_url, headers: auth_headers(@user), as: :json
      end
    end

    assert_response :unprocessable_content
    assert_equal "AI generator did not return any owned closet items.", response_json["error"]
  end

  test "outfit generation surfaces AI failure details" do
    with_outfit_generator_stub(
      error: OpenrouterOutfitGenerator::GenerationError.new(
        stage: "candidate_selection",
        message: "AI outfit generation failed during candidate selection: OpenRouter timed out",
        cause: RuntimeError.new("OpenRouter timed out")
      )
    ) do
      assert_no_difference("Outfit.count") do
        post generate_outfits_url, headers: auth_headers(@user), as: :json
      end
    end

    assert_response :unprocessable_content
    assert_equal "AI outfit generation failed during candidate selection: OpenRouter timed out", response_json["error"]
    assert_equal "candidate_selection", response_json["stage"]
    assert_equal "openrouter", response_json["provider"]
    assert_equal "RuntimeError", response_json["cause_class"]
    assert_equal "OpenRouter timed out", response_json["cause"]
  end

  test "cannot create an outfit using another user's item" do
    assert_no_difference("Outfit.count") do
      post outfits_url, params: {
        outfit: {
          name: "Forbidden Fit",
          item_ids: [ @other_user_item.id ]
        }
      }, headers: auth_headers(@user), as: :json
    end

    assert_response :unprocessable_content
    assert_includes response_json["errors"], "Item ids contain items you do not own"
  end

  test "can update an outfit and replace item list" do
    patch outfit_url(@outfit), params: {
      outfit: {
        name: "Weekend Capsule Updated",
        notes: "Updated note",
        item_ids: []
      }
    }, headers: auth_headers(@user), as: :json

    assert_response :success

    @outfit.reload
    assert_equal "Weekend Capsule Updated", @outfit.name
    assert_equal "Updated note", @outfit.notes
    assert_empty @outfit.clothing_item_ids
  end

  test "can update outfit collage layout and layer order" do
    extra_item = ClothingItem.create!(
      user: @user,
      name: "Layered Coat",
      size: :large,
      tags: [ "outerwear" ]
    )
    @outfit.clothing_items << extra_item

    patch outfit_url(@outfit), params: {
      outfit: {
        name: @outfit.name,
        item_ids: [ extra_item.id, @user_item.id ],
        item_layouts: [
          {
            item_id: extra_item.id,
            x: 18,
            y: 10,
            width: 44,
            height: 48,
            rotation: -8,
            layer_order: 0
          },
          {
            item_id: @user_item.id,
            x: 36,
            y: 32,
            width: 40,
            height: 42,
            rotation: 6,
            layer_order: 1
          }
        ]
      }
    }, headers: auth_headers(@user), as: :json

    assert_response :success
    assert_equal [ extra_item.id, @user_item.id ], response_json["item_ids"]
    assert_equal extra_item.id, response_json["items"].first["id"]
    assert_equal 18.0, response_json["items"].first["collage_layout"]["x"]
    assert_equal(-8.0, response_json["items"].first["collage_layout"]["rotation"])
    assert_equal 1, response_json["items"].second["layer_order"]

    @outfit.reload
    ordered_outfit_items = @outfit.outfit_items.order(:layer_order, :id)
    assert_equal [ extra_item.id, @user_item.id ], ordered_outfit_items.map(&:clothing_item_id)
    assert_equal 18.0, ordered_outfit_items.first.collage_x
    assert_equal 44.0, ordered_outfit_items.first.collage_width
    assert_equal(-8.0, ordered_outfit_items.first.collage_rotation)
    assert_equal 36.0, ordered_outfit_items.second.collage_x
    assert_equal 42.0, ordered_outfit_items.second.collage_height
    assert_equal 6.0, ordered_outfit_items.second.collage_rotation
  end

  test "saving an unchanged generated outfit records positive feedback" do
    run = create_generation_run_for(@outfit, generated_item_ids: [ @user_item.id ])

    assert_difference("OutfitGenerationEvent.count", 1) do
      patch outfit_url(@outfit), params: {
        outfit: {
          name: @outfit.name,
          item_ids: [ @user_item.id ]
        }
      }, headers: auth_headers(@user), as: :json
    end

    assert_response :success
    event = run.outfit_generation_events.order(:created_at).last
    assert_equal "saved_unchanged", event.event_type
    assert_equal [ @user_item.id ], event.final_item_ids
    assert_equal [ @user_item.id ], event.kept_item_ids
    assert_empty event.added_item_ids
    assert_empty event.removed_item_ids
  end

  test "saving edited generated outfit records item correction feedback" do
    replacement = ClothingItem.create!(
      user: @user,
      name: "Cream Mini Skirt",
      size: :na,
      category: "bottom"
    )
    run = create_generation_run_for(@outfit, generated_item_ids: [ @user_item.id ])

    assert_difference("OutfitGenerationEvent.count", 1) do
      patch outfit_url(@outfit), params: {
        outfit: {
          name: @outfit.name,
          item_ids: [ replacement.id ]
        }
      }, headers: auth_headers(@user), as: :json
    end

    assert_response :success
    event = run.outfit_generation_events.order(:created_at).last
    assert_equal "saved_with_item_changes", event.event_type
    assert_equal [ replacement.id ], event.final_item_ids
    assert_equal [ replacement.id ], event.added_item_ids
    assert_equal [ @user_item.id ], event.removed_item_ids
    assert_empty event.kept_item_ids
  end

  test "saving only generated outfit layout does not create item-change feedback" do
    run = create_generation_run_for(@outfit, generated_item_ids: [ @user_item.id ])

    patch outfit_url(@outfit), params: {
      outfit: {
        name: @outfit.name,
        item_ids: [ @user_item.id ],
        item_layouts: [
          {
            item_id: @user_item.id,
            x: 12,
            y: 14,
            width: 38,
            height: 42,
            rotation: 3,
            layer_order: 0
          }
        ]
      }
    }, headers: auth_headers(@user), as: :json

    assert_response :success
    assert_equal "saved_unchanged", run.outfit_generation_events.order(:created_at).last.event_type
  end

  test "outfit show returns the same saved collage layout after editing" do
    extra_item = ClothingItem.create!(
      user: @user,
      name: "Layered Coat",
      size: :large,
      tags: [ "outerwear" ]
    )
    @outfit.clothing_items << extra_item

    patch outfit_url(@outfit), params: {
      outfit: {
        name: @outfit.name,
        item_ids: [ extra_item.id, @user_item.id ],
        item_layouts: [
          {
            item_id: extra_item.id,
            x: 18,
            y: 10,
            width: 44,
            height: 48,
            rotation: -8,
            layer_order: 0
          },
          {
            item_id: @user_item.id,
            x: 36,
            y: 32,
            width: 40,
            height: 42,
            rotation: 6,
            layer_order: 1
          }
        ]
      }
    }, headers: auth_headers(@user), as: :json

    assert_response :success
    updated_items = response_json.fetch("items").map do |item|
      [
        item.fetch("id"),
        item.fetch("layer_order"),
        item.fetch("collage_layout")
      ]
    end
    updated_item_ids = response_json.fetch("item_ids")

    get outfit_url(@outfit), headers: auth_headers(@user), as: :json

    assert_response :success
    assert_equal updated_item_ids, response_json.fetch("item_ids")
    assert_equal updated_items, response_json.fetch("items").map { |item| [ item.fetch("id"), item.fetch("layer_order"), item.fetch("collage_layout") ] }
  end

  test "can update outfit collage layout with an item partially off canvas" do
    patch outfit_url(@outfit), params: {
      outfit: {
        name: @outfit.name,
        item_ids: [ @user_item.id ],
        item_layouts: [
          {
            item_id: @user_item.id,
            x: -20,
            y: 12,
            width: 40,
            height: 48,
            rotation: 0,
            layer_order: 0
          }
        ]
      }
    }, headers: auth_headers(@user), as: :json

    assert_response :success
    assert_equal(-20.0, response_json["items"].first["collage_layout"]["x"])

    @outfit.reload
    assert_equal(-20.0, @outfit.outfit_items.first.collage_x)
  end

  test "can delete an outfit" do
    assert_difference("Outfit.count", -1) do
      delete outfit_url(@outfit), headers: auth_headers(@user), as: :json
    end

    assert_response :no_content
  end

  test "deleting a generated outfit records weak negative feedback and keeps the run" do
    run = create_generation_run_for(@outfit, generated_item_ids: [ @user_item.id ])

    assert_difference("Outfit.count", -1) do
      assert_no_difference("OutfitGenerationRun.count") do
        assert_difference("OutfitGenerationEvent.count", 1) do
          delete outfit_url(@outfit), headers: auth_headers(@user), as: :json
        end
      end
    end

    assert_response :no_content
    run.reload
    assert_nil run.outfit_id
    event = run.outfit_generation_events.order(:created_at).last
    assert_equal "deleted", event.event_type
    assert_equal [ @user_item.id ], event.final_item_ids
  end

  private

  def create_generation_run_for(outfit, generated_item_ids:)
    OutfitGenerationRun.create!(
      user: outfit.user,
      outfit: outfit,
      candidate_item_ids: generated_item_ids,
      generated_item_ids: generated_item_ids,
      generator_version: OpenrouterOutfitGenerator::GENERATOR_VERSION,
      generated_at: Time.current
    )
  end

  def with_outfit_generator_stub(result: nil, error: nil, capture: nil)
    original = OpenrouterOutfitGenerator.method(:call)

    OpenrouterOutfitGenerator.singleton_class.send(:define_method, :call) do |items:, occasion: nil, reference_photo: nil, user: nil|
      capture&.replace(items: items, occasion: occasion, reference_photo: reference_photo, user: user)
      raise error if error

      result
    end

    yield
  ensure
    OpenrouterOutfitGenerator.singleton_class.send(:define_method, :call, original)
  end
end
