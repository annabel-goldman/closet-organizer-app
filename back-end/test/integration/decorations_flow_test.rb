require "test_helper"

class DecorationsFlowTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:one)
    @other_user = users(:two)
    @outfit = outfits(:one)
  end

  test "user can upload edit browse and delete a private PNG decoration" do
    image = Rack::Test::UploadedFile.new(file_fixture("item-photo.png"), "image/png")

    assert_difference("Decoration.count", 1) do
      post decorations_url, params: { decoration: { name: "Gold star", image: image } }, headers: auth_headers(@user)
    end

    assert_response :created
    decoration_id = response_json.fetch("id")
    assert_equal "Gold star", response_json.fetch("name")
    assert response_json.fetch("image_url").include?("/proxy/")

    get decorations_url, headers: auth_headers(@user), as: :json
    assert_response :success
    assert_equal [ decoration_id ], response_json.map { |decoration| decoration.fetch("id") }

    edited_image = Rack::Test::UploadedFile.new(file_fixture("item-photo.png"), "image/png")
    patch decoration_url(decoration_id), params: {
      decoration: { name: "Edited gold star", image: edited_image }
    }, headers: auth_headers(@user)
    assert_response :success
    assert_equal "Edited gold star", response_json.fetch("name")

    assert_difference("Decoration.count", -1) do
      delete decoration_url(decoration_id), headers: auth_headers(@user), as: :json
    end
    assert_response :no_content
  end

  test "decoration library rejects non PNG files and remains private" do
    invalid_image = Rack::Test::UploadedFile.new(file_fixture("item-photo.svg"), "image/svg+xml")
    assert_no_difference("Decoration.count") do
      post decorations_url, params: { decoration: { name: "Wrong type", image: invalid_image } }, headers: auth_headers(@user)
    end
    assert_response :unprocessable_content

    private_decoration = create_decoration(@other_user, "Private")
    get decorations_url, headers: auth_headers(@user), as: :json
    assert_response :success
    assert_not_includes response_json.map { |decoration| decoration.fetch("id") }, private_decoration.id
  end

  test "user can place and move a saved decoration on an owned outfit" do
    decoration = create_decoration(@user, "Flower")

    assert_difference("OutfitDecoration.count", 1) do
      post outfit_decorations_url(@outfit), params: {
        decoration: { decoration_id: decoration.id, x: 12, y: 18, width: 24, rotation: -8, layer_order: 2 }
      }, headers: auth_headers(@user), as: :json
    end
    assert_response :created
    placement_id = response_json.fetch("id")
    assert_equal decoration.id, response_json.fetch("decoration_id")
    assert_equal "Flower", response_json.fetch("name")

    patch outfit_decoration_url(@outfit, placement_id), params: {
      decoration: { x: 35, rotation: 10 }
    }, headers: auth_headers(@user), as: :json
    assert_response :success
    assert_equal 35.0, response_json.fetch("x")

    get outfit_url(@outfit), headers: auth_headers(@user), as: :json
    assert_response :success
    assert_equal [ placement_id ], response_json.fetch("decorations").map { |placement| placement.fetch("id") }
  end

  test "outfits and magazines reject another user's library decoration" do
    private_decoration = create_decoration(@other_user, "Private")
    folder = @user.outfit_folders.create!(name: "Weekend")

    assert_no_difference([ "OutfitDecoration.count", "OutfitFolderDecoration.count" ]) do
      post outfit_decorations_url(@outfit), params: {
        decoration: { decoration_id: private_decoration.id }
      }, headers: auth_headers(@user), as: :json
      assert_response :not_found

      post outfit_folder_decorations_url(folder), params: {
        decoration: { decoration_id: private_decoration.id, page_key: "cover" }
      }, headers: auth_headers(@user), as: :json
      assert_response :not_found
    end
  end

  private

  def create_decoration(user, name)
    decoration = user.decorations.new(name: name)
    decoration.image.attach(
      io: File.open(file_fixture("item-photo.png")),
      filename: "#{name.parameterize}.png",
      content_type: "image/png"
    )
    decoration.save!
    decoration
  end
end
