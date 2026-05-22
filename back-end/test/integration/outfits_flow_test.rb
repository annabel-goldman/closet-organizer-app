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

  test "can delete an outfit" do
    assert_difference("Outfit.count", -1) do
      delete outfit_url(@outfit), headers: auth_headers(@user), as: :json
    end

    assert_response :no_content
  end
end
