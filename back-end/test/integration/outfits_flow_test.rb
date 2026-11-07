require "test_helper"

class OutfitsFlowTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper

  setup do
    @user = users(:one)
    @other_user = users(:two)
    @outfit = outfits(:one)
    @user_item = clothing_items(:one)
    @other_user_item = clothing_items(:two)
    clear_enqueued_jobs
    clear_performed_jobs
  end

  teardown do
    clear_enqueued_jobs
    clear_performed_jobs
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

  test "saving, editing, and deleting a recommendation records learning" do
    run = @user.outfit_recommendation_runs.create!(prompt: "polished dinner")
    option = run.options.create!(rank: 1, status: :passing, clothing_item_ids: [ @user_item.id ])

    post outfits_url, params: {
      outfit: {
        name: "Recommended Dinner",
        item_ids: [ @user_item.id ],
        recommendation_option_id: option.id
      }
    }, headers: auth_headers(@user), as: :json

    assert_response :created
    outfit = Outfit.order(:created_at).last
    assert_equal option.id, response_json["recommendation_option_id"]
    assert_equal "save", run.feedback_events.last.event_type

    replacement = @user.clothing_items.create!(name: "Replacement Top", category: "top", size: :na)
    patch outfit_url(outfit), params: {
      outfit: { name: outfit.name, item_ids: [ replacement.id ] }
    }, headers: auth_headers(@user), as: :json

    assert_response :success
    assert_equal %w[add_after_save remove_after_save], run.feedback_events.order(:id).last(2).map(&:event_type).sort
    assert_difference(-> { run.feedback_events.count }, 1) do
      delete outfit_url(outfit), headers: auth_headers(@user), as: :json
    end

    assert_response :no_content
    deletion_feedback = run.feedback_events.order(:id).last
    assert_equal "delete_after_save", deletion_feedback.event_type
    assert_equal option.id, deletion_feedback.outfit_recommendation_option_id
    assert_equal({ "source" => "saved_outfit_delete" }, deletion_feedback.metadata)
  end

  test "suggests outfit details from the current draft items without saving" do
    captured = {}
    original_name = @outfit.name

    with_outfit_metadata_suggester_stub(
      capture: captured,
      result: {
        name: "Ivory Gallery Afternoon",
        tags: %w[ivory polished gallery],
        notes: "A polished ivory look for a gallery afternoon.",
        provider: "openrouter",
        model: "test/metadata"
      }
    ) do
      post generate_metadata_suggestions_outfit_url(@outfit), params: {
        outfit: {
          item_ids: [ @user_item.id ],
          name: "Outfit Aug 28",
          tags: [ "casual" ],
          notes: ""
        }
      }, headers: auth_headers(@user), as: :json
    end

    assert_response :success
    assert_equal "Ivory Gallery Afternoon", response_json["name"]
    assert_equal %w[ivory polished gallery], response_json["tags"]
    assert_equal [ @user_item.id ], captured.fetch(:items).map(&:id)
    assert_equal "Outfit Aug 28", captured.dig(:current_metadata, :name)
    assert_equal original_name, @outfit.reload.name
  end

  test "suggests outfit details for an unsaved cart draft without creating an outfit" do
    captured = {}

    with_outfit_metadata_suggester_stub(
      capture: captured,
      result: {
        name: "Soft Western Layers",
        tags: %w[cream floral western],
        notes: "A soft layered look with warm western accents.",
        provider: "openrouter",
        model: "test/metadata"
      }
    ) do
      assert_no_difference("Outfit.count") do
        post generate_metadata_suggestions_outfits_url, params: {
          outfit: {
            item_ids: [ @user_item.id ],
            name: "",
            tags: [],
            notes: ""
          }
        }, headers: auth_headers(@user), as: :json
      end
    end

    assert_response :success
    assert_equal "Soft Western Layers", response_json["name"]
    assert_equal [ @user_item.id ], captured.fetch(:items).map(&:id)
    assert_nil captured.dig(:current_metadata, :name)
    assert_equal [], captured.dig(:current_metadata, :tags)
    assert_equal "", captured.dig(:current_metadata, :notes)
  end

  test "unsaved outfit detail suggestions reject another user's item" do
    post generate_metadata_suggestions_outfits_url, params: {
      outfit: {
        item_ids: [ @other_user_item.id ]
      }
    }, headers: auth_headers(@user), as: :json

    assert_response :unprocessable_content
    assert_equal "Outfit details can only use items from your closet.", response_json["error"]
  end

  test "unsaved outfit detail suggestions require at least one item" do
    post generate_metadata_suggestions_outfits_url, params: {
      outfit: {
        item_ids: []
      }
    }, headers: auth_headers(@user), as: :json

    assert_response :unprocessable_content
    assert_equal "Add at least one item before filling outfit details.", response_json["error"]
  end

  test "outfit detail suggestions reject another user's item" do
    post generate_metadata_suggestions_outfit_url(@outfit), params: {
      outfit: {
        item_ids: [ @other_user_item.id ],
        name: @outfit.name
      }
    }, headers: auth_headers(@user), as: :json

    assert_response :unprocessable_content
    assert_equal "Outfit details can only use items from your closet.", response_json["error"]
  end

  test "outfit detail suggestions require at least one draft item" do
    post generate_metadata_suggestions_outfit_url(@outfit), params: {
      outfit: {
        item_ids: [],
        name: @outfit.name
      }
    }, headers: auth_headers(@user), as: :json

    assert_response :unprocessable_content
    assert_equal "Add at least one item before filling outfit details.", response_json["error"]
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
    assert_no_difference("OutfitRecommendationFeedbackEvent.count") do
      assert_difference("Outfit.count", -1) do
        delete outfit_url(@outfit), headers: auth_headers(@user), as: :json
      end
    end

    assert_response :no_content
  end

  private

  def with_outfit_metadata_suggester_stub(result:, capture: nil)
    original = OpenrouterOutfitMetadataSuggester.method(:call)

    OpenrouterOutfitMetadataSuggester.singleton_class.send(:define_method, :call) do |items:, current_metadata: {}|
      capture&.replace(items: items, current_metadata: current_metadata)
      result
    end

    yield
  ensure
    OpenrouterOutfitMetadataSuggester.singleton_class.send(:define_method, :call, original)
  end
end
