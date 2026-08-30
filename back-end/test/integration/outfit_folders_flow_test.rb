require "test_helper"

class OutfitFoldersFlowTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:one)
    @other_user = users(:two)
    @outfit = outfits(:one)
    @other_outfit = outfits(:two)
  end

  test "user can create, reorder, browse, and delete an outfit folder without deleting outfits" do
    second_outfit = @user.outfits.create!(name: "Dinner Look")

    assert_difference("OutfitFolder.count", 1) do
      post outfit_folders_url, params: {
        outfit_folder: {
          name: "Paris Weekend",
          occasion: "Paris · September",
          notes: "Three days of walking and dinner reservations.",
          page_layouts: {
            "cover" => {
              "title" => { "text" => "Paris After Dark", "x" => 8, "y" => 36, "width" => 84 }
            },
            "outfit:#{second_outfit.id}" => {
              "image_mode" => "flatlay",
              "image" => { "x" => 18, "y" => 20, "width" => 64 }
            }
          },
          outfit_ids: [ second_outfit.id, @outfit.id ]
        }
      }, headers: auth_headers(@user), as: :json
    end

    assert_response :created
    folder_id = response_json.fetch("id")
    assert_equal [ second_outfit.id, @outfit.id ], response_json.fetch("outfit_ids")
    assert_equal "Paris After Dark", response_json.dig("page_layouts", "cover", "title", "text")
    assert_equal "flatlay", response_json.dig("page_layouts", "outfit:#{second_outfit.id}", "image_mode")
    assert_equal [ "Dinner Look", @outfit.name ], response_json.fetch("outfits").map { |outfit| outfit.fetch("name") }
    assert_not response_json.key?("theme")

    get outfit_folders_url, headers: auth_headers(@user), as: :json

    assert_response :success
    assert_equal [ folder_id ], response_json.map { |folder| folder.fetch("id") }

    patch outfit_folder_url(folder_id), params: {
      outfit_folder: {
        name: "Paris Weekend",
        occasion: "Paris · September",
        notes: "Updated notes",
        outfit_ids: [ @outfit.id, second_outfit.id ]
      }
    }, headers: auth_headers(@user), as: :json

    assert_response :success
    assert_equal [ @outfit.id, second_outfit.id ], response_json.fetch("outfit_ids")
    assert_equal "Paris After Dark", response_json.dig("page_layouts", "cover", "title", "text")

    assert_no_difference("Outfit.count") do
      assert_difference("OutfitFolder.count", -1) do
        delete outfit_folder_url(folder_id), headers: auth_headers(@user), as: :json
      end
    end

    assert_response :no_content
  end

  test "folder cannot include another user's outfit" do
    assert_no_difference("OutfitFolder.count") do
      post outfit_folders_url, params: {
        outfit_folder: {
          name: "Not mine",
          outfit_ids: [ @other_outfit.id ]
        }
      }, headers: auth_headers(@user), as: :json
    end

    assert_response :unprocessable_content
  end

  test "magazine page layouts reject unsupported image modes" do
    assert_no_difference("OutfitFolder.count") do
      post outfit_folders_url, params: {
        outfit_folder: {
          name: "Invalid layout",
          page_layouts: {
            "outfit:#{@outfit.id}" => { "image_mode" => "three_dimensional" }
          },
          outfit_ids: [ @outfit.id ]
        }
      }, headers: auth_headers(@user), as: :json
    end

    assert_response :unprocessable_content
    assert_includes response_json.fetch("errors").join(" "), "invalid image mode"
  end

  test "removing an outfit from a magazine retires its saved page layout" do
    folder = @user.outfit_folders.create!(
      name: "Weekend",
      page_layouts: {
        "cover" => { "title" => { "x" => 8, "y" => 38, "width" => 84 } },
        "outfit:#{@outfit.id}" => { "image_mode" => "modeled" }
      }
    )
    folder.memberships.create!(outfit: @outfit, position: 0)

    patch outfit_folder_url(folder), params: {
      outfit_folder: { name: folder.name, outfit_ids: [] }
    }, headers: auth_headers(@user), as: :json

    assert_response :success
    assert_equal [ "cover" ], response_json.fetch("page_layouts").keys
  end

  test "suggests an editable magazine concept and owned outfit selection without saving" do
    captured = {}

    with_magazine_suggester_stub(
      capture: captured,
      result: {
        name: "Paris After Dark",
        notes: "A polished sequence for gallery afternoons and late dinners.",
        outfit_ids: [ @outfit.id ],
        provider: "openrouter",
        model: "test/metadata"
      }
    ) do
      assert_no_difference("OutfitFolder.count") do
        post generate_metadata_suggestions_outfit_folders_url, params: {
          outfit_folder: {
            name: "Paris",
            notes: "Gallery and dinner",
            outfit_ids: []
          }
        }, headers: auth_headers(@user), as: :json
      end
    end

    assert_response :success
    assert_equal "Paris After Dark", response_json.fetch("name")
    assert_equal [ @outfit.id ], response_json.fetch("outfit_ids")
    assert_equal [ @outfit.id ], captured.fetch(:outfits).map(&:id)
    assert_equal "Paris", captured.dig(:current_metadata, :name)
    assert_equal "Gallery and dinner", captured.dig(:current_metadata, :notes)
    assert_equal [], captured.dig(:current_metadata, :outfit_ids)
  end

  test "magazine suggestions reject another user's selected outfit" do
    post generate_metadata_suggestions_outfit_folders_url, params: {
      outfit_folder: {
        name: "Private",
        outfit_ids: [ @other_outfit.id ]
      }
    }, headers: auth_headers(@user), as: :json

    assert_response :unprocessable_content
    assert_equal "Magazine suggestions can only use your saved outfits.", response_json.fetch("error")
  end

  test "user cannot access another user's folder" do
    folder = @other_user.outfit_folders.create!(name: "Private trip")

    get outfit_folder_url(folder), headers: auth_headers(@user), as: :json

    assert_response :not_found
  end

  test "user can add, move, and remove private clip art from a magazine page" do
    folder = @user.outfit_folders.create!(name: "Beach Week")
    folder.memberships.create!(outfit: @outfit, position: 0)
    image = Rack::Test::UploadedFile.new(file_fixture("item-photo.png"), "image/png")

    assert_difference("OutfitFolderDecoration.count", 1) do
      post outfit_folder_decorations_url(folder), params: {
        decoration: {
          image: image,
          page_key: "outfit:#{@outfit.id}",
          x: 12,
          y: 18,
          width: 24,
          rotation: -8,
          layer_order: 2
        }
      }, headers: auth_headers(@user)
    end

    assert_response :created
    decoration_id = response_json.fetch("id")
    assert_equal "outfit:#{@outfit.id}", response_json.fetch("page_key")
    assert_equal 12.0, response_json.fetch("x")
    assert response_json.fetch("image_url").present?

    patch outfit_folder_decoration_url(folder, decoration_id), params: {
      decoration: { x: 35, y: 40, width: 30, rotation: 10 }
    }, headers: auth_headers(@user), as: :json

    assert_response :success
    assert_equal 35.0, response_json.fetch("x")
    assert_equal 10.0, response_json.fetch("rotation")

    assert_difference("OutfitFolderDecoration.count", -1) do
      delete outfit_folder_decoration_url(folder, decoration_id), headers: auth_headers(@user), as: :json
    end

    assert_response :no_content
  end

  test "clip art cannot target an outfit outside the folder" do
    folder = @user.outfit_folders.create!(name: "Beach Week")
    image = Rack::Test::UploadedFile.new(file_fixture("item-photo.png"), "image/png")

    assert_no_difference("OutfitFolderDecoration.count") do
      post outfit_folder_decorations_url(folder), params: {
        decoration: { image: image, page_key: "outfit:#{@outfit.id}" }
      }, headers: auth_headers(@user)
    end

    assert_response :unprocessable_content
  end

  test "deleting an outfit removes its folder membership and retired magazine-page decorations" do
    outfit = @user.outfits.create!(name: "One-night look")
    folder = @user.outfit_folders.create!(name: "Weekend")
    folder.memberships.create!(outfit: outfit, position: 0)
    decoration = folder.decorations.new(page_key: "outfit:#{outfit.id}")
    image = StringIO.new(file_fixture("item-photo.png").binread)
    decoration.image.attach(io: image, filename: "star.png", content_type: "image/png")
    decoration.save!

    assert_difference("OutfitFolderMembership.count", -1) do
      assert_difference("OutfitFolderDecoration.count", -1) do
        delete outfit_url(outfit), headers: auth_headers(@user), as: :json
      end
    end

    assert_response :no_content
    assert folder.reload.persisted?
  end

  private

  def with_magazine_suggester_stub(result:, capture: nil)
    original = OpenrouterMagazineSuggester.method(:call)

    OpenrouterMagazineSuggester.singleton_class.send(:define_method, :call) do |outfits:, current_metadata: {}|
      capture&.replace(outfits: outfits, current_metadata: current_metadata)
      result
    end

    yield
  ensure
    OpenrouterMagazineSuggester.singleton_class.send(:define_method, :call, original)
  end
end
