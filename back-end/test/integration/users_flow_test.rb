require "test_helper"

class UsersFlowTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:one)
    @admin = users(:two)
  end

  test "admin can load users index" do
    get users_url, headers: auth_headers(@admin), as: :json

    assert_response :success
    usernames = response_json["users"].map { |user| user["username"] }.sort
    assert_equal [ @user.username, @admin.username ].sort, usernames
    assert_equal 2, response_json.dig("meta", "total_count")
    assert_equal 1, response_json.dig("meta", "page")
  end

  test "users index paginates with page and per_page" do
    get users_url(page: 1, per_page: 1), headers: auth_headers(@admin), as: :json

    assert_response :success
    assert_equal 1, response_json["users"].size
    assert_equal 2, response_json.dig("meta", "total_count")
    assert_equal 2, response_json.dig("meta", "total_pages")
  end

  test "browser html request for users index falls back to the frontend app" do
    get "/users"

    assert_response :success
    assert_includes response.body, "<div id=\"root\"></div>"
  end

  test "non-admin cannot load users index" do
    get users_url, headers: auth_headers(@user), as: :json

    assert_response :forbidden
    assert_equal "You're not authorized to view this page.", response_json["error"]
  end

  test "admin can load user show" do
    get user_url(@user), headers: auth_headers(@admin), as: :json

    assert_response :success
    assert_equal @user.username, response_json["username"]
  end

  test "browser html request for user show falls back to the frontend app" do
    get "/users/#{@user.id}"

    assert_response :success
    assert_includes response.body, "<div id=\"root\"></div>"
  end

  test "non-admin cannot load user show" do
    get user_url(@admin), headers: auth_headers(@user), as: :json

    assert_response :forbidden
    assert_equal "You're not authorized to view this page.", response_json["error"]
  end

  test "user creation is handled through google sign-in" do
    assert_no_difference("User.count") do
      post users_url, params: {
        user: {
          username: "sam",
          preferred_style: "smart casual",
          password: "password123",
          password_confirmation: "password123"
        }
      }, headers: auth_headers(@user), as: :json
    end

    assert_response :unauthorized
    assert_equal "User creation is handled through Google sign-in.", response_json["error"]
  end

  test "can update a user without changing password" do
    patch user_url(@user), params: {
      user: {
        username: "alex-updated",
        preferred_style: "minimal",
        password: "",
        password_confirmation: ""
      }
    }, headers: auth_headers(@user), as: :json

    assert_response :success
    assert_equal "alex-updated", @user.reload.username
    assert_equal "alex-updated", response_json["username"]
    assert @user.authenticate("password123")
  end

  test "user can add, view, reorder, and remove private model references" do
    post model_reference_images_url, params: {
      model_reference_images: {
        photos: [ item_photo_upload, item_photo_upload ]
      }
    }, headers: auth_headers(@user)

    assert_response :created
    assert_equal 2, response_json["model_reference_photo_count"]
    assert response_json["model_reference_photo_attached"]
    assert_not_nil response_json["model_reference_consent_at"]
    references = response_json.fetch("model_reference_photos")
    assert_equal [ 0, 1 ], references.map { |reference| reference.fetch("position") }

    first_reference_id = references.first.fetch("id")
    get photo_model_reference_image_url(first_reference_id), headers: auth_headers(@user)

    assert_response :success
    assert_equal "image/png", response.media_type
    assert_includes response.headers["Cache-Control"], "private"
    assert_includes response.headers["Cache-Control"], "max-age=300"

    get photo_model_reference_image_url(first_reference_id), headers: auth_headers(@admin)
    assert_response :not_found

    ordered_ids = references.reverse.map { |reference| reference.fetch("id") }
    patch reorder_model_reference_images_url, params: {
      reference_image_ids: ordered_ids
    }, headers: auth_headers(@user), as: :json

    assert_response :success
    assert_equal ordered_ids, response_json.fetch("model_reference_photos").map { |reference| reference.fetch("id") }

    delete model_reference_image_url(first_reference_id), headers: auth_headers(@user), as: :json

    assert_response :success
    assert_equal 1, response_json["model_reference_photo_count"]
    assert_not_nil response_json["model_reference_consent_at"]

    delete me_model_reference_url, headers: auth_headers(@user), as: :json

    assert_response :success
    assert_equal 0, response_json["model_reference_photo_count"]
    assert_nil response_json["model_reference_consent_at"]
  end

  test "user cannot save more than three model reference photos" do
    post model_reference_images_url, params: {
      model_reference_images: {
        photos: [ item_photo_upload, item_photo_upload, item_photo_upload ]
      }
    }, headers: auth_headers(@user)

    assert_response :created

    post model_reference_images_url, params: {
      model_reference_images: { photos: [ item_photo_upload ] }
    }, headers: auth_headers(@user)

    assert_response :unprocessable_content
    assert_includes response_json["error"], "up to 3"
    assert_equal 3, @user.model_reference_images.count
  end

  test "can delete a user" do
    assert_difference("User.count", -1) do
      delete user_url(@user), headers: auth_headers(@user), as: :json
    end

    assert_response :no_content
  end

  private

  def item_photo_upload
    Rack::Test::UploadedFile.new(file_fixture("item-photo.png"), "image/png")
  end
end
