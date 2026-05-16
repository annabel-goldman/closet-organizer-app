require "test_helper"

class ClothingItemsFlowTest < ActionDispatch::IntegrationTest
  setup do
    @clothing_item = clothing_items(:one)
    @user = users(:one)
  end

  test "clothing items index loads" do
    get clothing_items_url, headers: auth_headers(@user), as: :json

    assert_response :success
    assert_includes response_json.map { |item| item["name"] }, @clothing_item.name
  end

  test "clothing item show loads" do
    get clothing_item_url(@clothing_item), headers: auth_headers(@user), as: :json

    assert_response :success
    assert_equal @clothing_item.name, response_json["name"]
    assert_equal @clothing_item.category, response_json["category"]
  end

  test "can create a clothing item" do
    assert_difference("ClothingItem.count", 1) do
      post clothing_items_url, params: {
        clothing_item: {
          category: "coat",
          name: "Camel Coat",
          user_id: @user.id,
          size: "large",
          date: "2026-04-20",
          tags: [ "wool", "camel", "tailored", "studio north" ],
          brand: "Studio North"
        }
      }, headers: auth_headers(@user), as: :json
    end

    assert_response :created
    assert_equal "coat", response_json["category"]
    assert_equal "Camel Coat", response_json["name"]
    assert_equal "large", response_json["size"]
    assert_equal "Studio North", response_json["brand"]
    assert_equal [ "wool", "camel", "tailored", "studio north" ], response_json["tags"]
  end

  test "can create a clothing item with a photo" do
    assert_difference("ClothingItem.count", 1) do
      post clothing_items_url, params: {
        clothing_item: {
          name: "Photo Tee",
          category: "shirt",
          user_id: @user.id,
          size: "medium",
          tags: [ "white", "tee", "casual" ],
          photo: item_photo_upload
        }
      }, headers: auth_headers(@user)
    end

    assert_response :created
    assert_predicate ClothingItem.order(:created_at).last.photo, :attached?
    assert_match %r{/rails/active_storage/}, response_json["image_url"]
  end

  test "can create a clothing item with a cropped photo" do
    assert_difference("ClothingItem.count", 1) do
      post clothing_items_url, params: {
        clothing_item: {
          name: "Cropped Shirt",
          user_id: @user.id,
          size: "medium",
          tags: [ "white", "shirt", "cropped" ],
          photo: item_photo_upload_png,
          crop_x: "0.1",
          crop_y: "0.1",
          crop_width: "0.5",
          crop_height: "0.5"
        }
      }, headers: auth_headers(@user)
    end

    assert_response :created

    created_item = ClothingItem.order(:created_at).last
    assert_predicate created_item.photo, :attached?
    assert_equal "image/png", created_item.photo.blob.content_type
    assert_match(/crop\.png\z/, created_item.photo.blob.filename.to_s)
  end

  test "can create a clothing item from a verified outfit detection crop" do
    upload = OutfitUpload.new(user: @user, status: :succeeded, provider: "openrouter")
    upload.source_photo.attach(item_photo_upload_png)
    upload.save!
    detection = upload.outfit_detections.create!(
      category: "shirt",
      confidence: 0.91,
      suggested_name: "Verified Shirt",
      details: { dominant_color: "white" },
      coarse_bbox_x: 0.12,
      coarse_bbox_y: 0.1,
      coarse_bbox_width: 0.42,
      coarse_bbox_height: 0.48,
      refined_bbox_x: 0.14,
      refined_bbox_y: 0.12,
      refined_bbox_width: 0.36,
      refined_bbox_height: 0.42,
      final_bbox_x: 0.15,
      final_bbox_y: 0.13,
      final_bbox_width: 0.34,
      final_bbox_height: 0.4,
      crop_status: :verified,
      crop_attempts: 2,
      position: 0
    )

    assert_difference("ClothingItem.count", 1) do
      post clothing_items_url, params: {
        clothing_item: {
          name: "Verified Shirt",
          user_id: @user.id,
          size: "medium",
          tags: [ "white", "shirt", "verified" ],
          source_outfit_detection_id: detection.id
        }
      }, headers: auth_headers(@user)
    end

    assert_response :created

    created_item = ClothingItem.order(:created_at).last
    assert_predicate created_item.photo, :attached?
    assert_equal "image/png", created_item.photo.blob.content_type
    assert_match(/crop\.png\z/, created_item.photo.blob.filename.to_s)
    assert_equal "shirt", created_item.category
    assert_equal upload.id, created_item.source_outfit_upload_id
    assert_equal detection.id, created_item.source_outfit_detection_id
  end

  test "prefers a cleaned outfit detection image when creating a clothing item" do
    upload = OutfitUpload.new(user: @user, status: :succeeded, provider: "openrouter")
    upload.source_photo.attach(item_photo_upload_png)
    upload.save!
    detection = upload.outfit_detections.create!(
      category: "shirt",
      confidence: 0.91,
      suggested_name: "Verified Shirt",
      details: { dominant_color: "white" },
      coarse_bbox_x: 0.12,
      coarse_bbox_y: 0.1,
      coarse_bbox_width: 0.42,
      coarse_bbox_height: 0.48,
      refined_bbox_x: 0.14,
      refined_bbox_y: 0.12,
      refined_bbox_width: 0.36,
      refined_bbox_height: 0.42,
      final_bbox_x: 0.15,
      final_bbox_y: 0.13,
      final_bbox_width: 0.34,
      final_bbox_height: 0.4,
      crop_status: :verified,
      crop_attempts: 2,
      position: 0
    )
    detection.cleaned_photo.attach(item_photo_upload_png)

    assert_difference("ClothingItem.count", 1) do
      post clothing_items_url, params: {
        clothing_item: {
          name: "Verified Shirt",
          user_id: @user.id,
          size: "medium",
          tags: [ "white", "shirt", "verified" ],
          source_outfit_detection_id: detection.id
        }
      }, headers: auth_headers(@user)
    end

    assert_response :created

    created_item = ClothingItem.order(:created_at).last
    assert_predicate created_item.photo, :attached?
    assert_match(/item-photo\.png\z/, created_item.photo.blob.filename.to_s)
    assert_equal upload.id, created_item.source_outfit_upload_id
    assert_equal detection.id, created_item.source_outfit_detection_id
  end

  test "can update a clothing item" do
    patch clothing_item_url(@clothing_item), params: {
      clothing_item: {
        category: "blouse",
        name: "Ivory Silk Blouse",
        user_id: @user.id,
        size: "small",
        date: "2026-04-18",
        tags: [ "silk", "ivory", "dressy", "maison" ]
      }
    }, headers: auth_headers(@user), as: :json

    assert_response :success

    @clothing_item.reload
    assert_equal "blouse", @clothing_item.category
    assert_equal "Ivory Silk Blouse", @clothing_item.name
    assert_equal "small", @clothing_item.size
    assert_equal [ "silk", "ivory", "dressy", "maison" ], @clothing_item.tags
    assert_equal [ "silk", "ivory", "dressy", "maison" ], response_json["tags"]
  end

  test "can remove a clothing item photo" do
    @clothing_item.photo.attach(item_photo_upload)

    patch clothing_item_url(@clothing_item), params: {
      clothing_item: {
        name: @clothing_item.name,
        user_id: @user.id,
        size: @clothing_item.size,
        date: @clothing_item.date&.to_date&.iso8601,
        tags: @clothing_item.tags,
        remove_photo: "true"
      }
    }, headers: auth_headers(@user)

    assert_response :success

    @clothing_item.reload
    assert_not @clothing_item.photo.attached?
    assert_nil response_json["image_url"]
  end

  test "can generate a clean image for an existing clothing item photo" do
    @clothing_item.photo.attach(item_photo_upload_png)
    captured = {}

    with_image_cleaner_stub(capture: captured) do
      post generate_clean_image_clothing_item_url(@clothing_item), params: {
        ai_context: {
          name: "Ivory Silk Blouse",
          brand: "Maison North",
          tags: [ "ivory", "silk", "blouse" ]
        }
      }, headers: auth_headers(@user)
    end

    assert_response :success

    @clothing_item.reload
    assert_predicate @clothing_item.cleaned_photo, :attached?
    assert_equal "succeeded", response_json["clean_image_status"]
    assert_equal response_json["cleaned_image_url"], response_json["image_url"]
    assert_equal "Ivory Silk Blouse", captured.dig(:metadata_context, :name)
    assert_equal "Maison North", captured.dig(:metadata_context, :brand)
  end

  test "can generate metadata suggestions for an existing clothing item photo" do
    @clothing_item.photo.attach(item_photo_upload_png)
    captured = {}

    with_metadata_suggester_stub(capture: captured) do
      post generate_metadata_suggestions_clothing_item_url(@clothing_item), params: {
        ai_context: {
          category: "blouse",
          name: "Ivory Silk Blouse",
          brand: "Maison North",
          tags: [ "ivory", "silk", "blouse" ]
        }
      }, headers: auth_headers(@user)
    end

    assert_response :success
    assert_equal "blouse", response_json["category"]
    assert_equal "Ivory Silk Blouse", response_json["name"]
    assert_equal "Maison North", response_json["brand"]
    assert_equal [ "ivory", "silk", "blouse" ], response_json["tags"]
    assert_equal "blouse", captured.dig(:metadata_context, :category)
    assert_equal "Ivory Silk Blouse", captured.dig(:metadata_context, :name)
    assert_equal "Maison North", captured.dig(:metadata_context, :brand)
  end

  test "can delete a clothing item" do
    assert_difference("ClothingItem.count", -1) do
      delete clothing_item_url(@clothing_item), headers: auth_headers(@user), as: :json
    end

    assert_response :no_content
  end

  private

  def item_photo_upload
    Rack::Test::UploadedFile.new(file_fixture("item-photo.svg"), "image/svg+xml")
  end

  def item_photo_upload_png
    Rack::Test::UploadedFile.new(file_fixture("item-photo.png"), "image/png")
  end

  def with_metadata_suggester_stub(capture: nil)
    original = OpenrouterMetadataSuggester.method(:call)

    OpenrouterMetadataSuggester.singleton_class.send(:define_method, :call) do |_source_photo, category_hint: nil, reference_photos: [], metadata_context: {}|
      capture&.replace(
        category_hint: category_hint,
        reference_photos: reference_photos,
        metadata_context: metadata_context
      )

      {
        category: category_hint.presence || metadata_context[:category] || "blouse",
        name: category_hint.present? ? "#{category_hint.to_s.titleize} Item" : "Ivory Silk Blouse",
        brand: "Maison North",
        tags: [ "ivory", "silk", "blouse" ],
        provider: "openrouter",
        vision_model: "openai/gpt-4.1-mini"
      }
    end

    yield
  ensure
    OpenrouterMetadataSuggester.singleton_class.send(:define_method, :call, original)
  end

  def with_image_cleaner_stub(capture: nil)
    original = OpenrouterImageCleaner.method(:call)
    fixture_path = file_fixture("item-photo.png")

    OpenrouterImageCleaner.singleton_class.send(:define_method, :call) do |_source_photo, prompt_context: {}, reference_photos: [], metadata_context: {}|
      capture&.replace(
        prompt_context: prompt_context,
        reference_photos: reference_photos,
        metadata_context: metadata_context
      )

      tempfile = Tempfile.new([ "cleaned-photo", ".png" ])
      tempfile.binmode
      tempfile.write(File.binread(fixture_path))
      tempfile.rewind

      {
        tempfile: tempfile,
        filename: "cleaned-photo.png",
        content_type: "image/png",
        provider: "openrouter",
        model: "google/gemini-2.5-flash-image",
        raw_response: { "id" => "img_123", "prompt_context" => prompt_context }
      }
    end

    yield
  ensure
    OpenrouterImageCleaner.singleton_class.send(:define_method, :call, original)
  end
end
