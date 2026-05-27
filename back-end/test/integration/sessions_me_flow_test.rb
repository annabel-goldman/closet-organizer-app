require "test_helper"

class SessionsMeFlowTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:one)
  end

  test "me returns the current user and clothing items" do
    get me_url, headers: auth_headers(@user), as: :json

    assert_response :success
    assert_equal @user.id, response_json["id"]
    assert_equal @user.clothing_items.count, response_json["clothing_items_count"]
    assert_equal response_json["clothing_items_count"], response_json["clothing_items"].length
    assert response_json["clothing_items"].all? { |item| item.key?("cleaned_working_image_url") }
  end

  test "me returns unauthorized when there is no session" do
    get me_url, as: :json

    assert_response :unauthorized
  end
end
