require "test_helper"

class OutfitUploadsFlowTest < ActionDispatch::IntegrationTest
  include ActiveJob::TestHelper

  setup do
    @user = users(:one)
    clear_enqueued_jobs
    clear_performed_jobs
  end

  teardown do
    clear_enqueued_jobs
    clear_performed_jobs
  end

  test "can create an outfit upload and later persist detections" do
    detector_response = {
      provider: "openrouter",
      vision_model: "openai/gpt-4.1-mini",
      raw_response: { "id" => "resp_123" },
      items: [
        {
          category: "shirt",
          confidence: 0.92,
          suggested_name: "White Button-Up Shirt",
          coarse_box: {
            x: 0.12,
            y: 0.08,
            width: 0.38,
            height: 0.42
          },
          single_item_visible: true,
          details: {
            dominant_color: "white",
            material_guess: "cotton",
            style_guess: "classic",
            notes: "Long sleeves are visible."
          }
        },
        {
          category: "pants",
          confidence: 0.88,
          suggested_name: "Black Tailored Pants",
          coarse_box: {
            x: 0.2,
            y: 0.5,
            width: 0.34,
            height: 0.4
          },
          single_item_visible: true,
          details: {
            dominant_color: "black",
            material_guess: "",
            style_guess: "tailored",
            notes: ""
          }
        }
      ]
    }

    with_detector_stub(detector_response) do
      assert_difference("OutfitUpload.count", 1) do
        assert_enqueued_jobs 1, only: OutfitUploadAnalysisJob do
          post outfit_uploads_url, params: {
            outfit_upload: {
              user_id: @user.id,
              source_photo: item_photo_upload
            }
          }, headers: auth_headers(@user)
        end
      end

      assert_response :created
      assert_equal "pending", response_json["status"]
      assert_equal "outfit_upload", response_json.dig("ai_workflow", "kind")
      assert_equal response_json["id"], response_json.dig("ai_workflow", "metadata", "upload_id")
      assert_equal "item-photo.png", response_json.dig("ai_workflow", "metadata", "upload_name")
      assert_equal %w[detect], response_json.dig("ai_workflow", "stages").map { |stage| stage.fetch("key") }
      assert_nil response_json["vision_model"]
      assert_equal [], response_json["detections"]
      assert_match %r{/rails/active_storage/}, response_json["source_photo_url"]

      upload_id = response_json["id"]

      assert_difference("OutfitDetection.count", 2) do
        perform_enqueued_jobs only: OutfitUploadAnalysisJob
      end

      get outfit_upload_url(upload_id), headers: auth_headers(@user), as: :json

      assert_response :success
      assert_equal "succeeded", response_json["status"]
      assert_equal "openai/gpt-4.1-mini", response_json["vision_model"]
      assert_equal 2, response_json["detections"].length
      assert_equal "shirt", response_json["detections"].first["category"]
      assert_not response_json["detections"].first.key?("crop_status")
      assert_equal 0.12, response_json["detections"].first["coarse_box"]["x"]
      assert_nil response_json["detections"].first["refined_box"]
      assert_nil response_json["detections"].first["final_box"]
    end
  end

  test "returns a failed upload payload after async detection raises an error" do
    with_detector_stub(->(_upload) { raise "OPENROUTER_API_KEY is not configured." }) do
      post outfit_uploads_url, params: {
        outfit_upload: {
          user_id: @user.id,
          source_photo: item_photo_upload
        }
      }, headers: auth_headers(@user)
    end

    assert_response :created
    assert_equal "pending", response_json["status"]
    assert_nil response_json["error_message"]
    assert_equal [], response_json["detections"]

    upload_id = response_json["id"]

    perform_enqueued_jobs only: OutfitUploadAnalysisJob

    get outfit_upload_url(upload_id), headers: auth_headers(@user), as: :json

    assert_response :success
    assert_equal "failed", response_json["status"]
    assert_equal "OPENROUTER_API_KEY is not configured.", response_json["error_message"]
    assert_equal [], response_json["detections"]
  end

  test "can cancel queued outfit-photo detection" do
    post outfit_uploads_url, params: {
      outfit_upload: {
        user_id: @user.id,
        source_photo: item_photo_upload
      }
    }, headers: auth_headers(@user)

    assert_response :created
    upload_id = response_json.fetch("id")
    workflow_id = response_json.dig("ai_workflow", "id")

    post cancel_ai_workflow_url(workflow_id), headers: auth_headers(@user), as: :json

    assert_response :success
    assert_equal "cancelled", response_json["status"]
    perform_enqueued_jobs only: OutfitUploadAnalysisJob

    get outfit_upload_url(upload_id), headers: auth_headers(@user), as: :json
    assert_response :success
    assert_equal "cancelled", response_json["status"]
    assert_equal [], response_json["detections"]
  end

  test "a cancelled outfit-photo workflow discards a late analyzer failure" do
    post outfit_uploads_url, params: {
      outfit_upload: {
        user_id: @user.id,
        source_photo: item_photo_upload
      }
    }, headers: auth_headers(@user)

    assert_response :created
    upload_id = response_json.fetch("id")
    workflow_id = response_json.dig("ai_workflow", "id")

    analyzer = lambda do |upload|
      AiWorkflow.find(workflow_id).cancel!
      upload.update!(status: :failed, error_message: "Late provider failure")
      raise "Late provider failure"
    end

    original_analyzer = OutfitUploadAnalyzer.method(:call)
    OutfitUploadAnalyzer.singleton_class.send(:define_method, :call, analyzer)

    begin
      perform_enqueued_jobs only: OutfitUploadAnalysisJob
    ensure
      OutfitUploadAnalyzer.singleton_class.send(:define_method, :call, original_analyzer)
    end

    get outfit_upload_url(upload_id), headers: auth_headers(@user), as: :json

    assert_response :success
    assert_equal "cancelled", response_json["status"]
    assert_nil response_json["error_message"]
    assert_equal "cancelled", AiWorkflow.find(workflow_id).status
  end

  test "can fetch an existing outfit upload" do
    upload = OutfitUpload.new(user: @user)
    upload.source_photo.attach(item_photo_upload)
    upload.status = :succeeded
    upload.provider = "openrouter"
    upload.vision_model = "openai/gpt-4.1-mini"
    upload.save!
    upload.outfit_detections.create!(
      category: "jacket",
      confidence: 0.81,
      suggested_name: "Blue Denim Jacket",
      details: { dominant_color: "blue" },
      coarse_bbox_x: 0.1,
      coarse_bbox_y: 0.15,
      coarse_bbox_width: 0.3,
      coarse_bbox_height: 0.45,
      refined_bbox_x: 0.11,
      refined_bbox_y: 0.16,
      refined_bbox_width: 0.28,
      refined_bbox_height: 0.42,
      final_bbox_x: 0.12,
      final_bbox_y: 0.18,
      final_bbox_width: 0.26,
      final_bbox_height: 0.39,
      crop_status: :verified,
      crop_confidence: 0.84,
      crop_quality_score: 0.9,
      crop_notes: "Verified crop.",
      crop_attempts: 2,
      bbox_x: 0.1,
      bbox_y: 0.15,
      bbox_width: 0.3,
      bbox_height: 0.45,
      position: 0
    )

    get outfit_upload_url(upload), headers: auth_headers(@user), as: :json

    assert_response :success
    assert_equal upload.id, response_json["id"]
    assert_equal 1, response_json["detections"].length
    assert_equal "jacket", response_json["detections"].first["category"]
    assert_not response_json["detections"].first.key?("crop_status")
    assert_equal 0.26, response_json["detections"].first["final_box"]["width"]
  end

  test "can persist generated and transparent versions for an outfit detection" do
    upload = OutfitUpload.new(user: @user)
    upload.source_photo.attach(item_photo_upload)
    upload.status = :succeeded
    upload.provider = "openrouter"
    upload.vision_model = "openai/gpt-4.1-mini"
    upload.save!
    detection = upload.outfit_detections.create!(
      category: "jacket",
      confidence: 0.81,
      suggested_name: "Blue Denim Jacket",
      details: { dominant_color: "blue" },
      coarse_bbox_x: 0.1,
      coarse_bbox_y: 0.15,
      coarse_bbox_width: 0.3,
      coarse_bbox_height: 0.45,
      refined_bbox_x: 0.11,
      refined_bbox_y: 0.16,
      refined_bbox_width: 0.28,
      refined_bbox_height: 0.42,
      final_bbox_x: 0.12,
      final_bbox_y: 0.18,
      final_bbox_width: 0.26,
      final_bbox_height: 0.39,
      crop_status: :verified,
      crop_confidence: 0.84,
      crop_quality_score: 0.9,
      crop_attempts: 2,
      position: 0
    )

    captured = {}

    with_image_cleaner_stub(capture: captured) do
      post generate_image_outfit_detection_url(detection), params: {
        ai_context: {
          name: "Blue Denim Jacket",
          brand: "Acme Atelier",
          tags: [ "blue", "denim", "jacket" ]
        }
      }, headers: auth_headers(@user)
    end

    assert_response :success

    detection.reload
    assert_not detection.cleaned_photo.attached?
    assert_equal %w[original generated], detection.image_versions.in_display_order.pluck(:variant_kind)
    assert_predicate detection.image_versions.find_by!(variant_kind: "generated"), :selected?
    assert_nil response_json["transparent_image_url"]
    assert_match %r{/rails/active_storage/}, response_json["generated_image_url"]
    assert_equal "succeeded", response_json["clean_image_status"]
    assert_equal "Blue Denim Jacket", captured.dig(:metadata_context, :name)
    assert_equal "Acme Atelier", captured.dig(:metadata_context, :brand)
    assert_equal 1, captured[:reference_photos].size

    post remove_image_background_outfit_detection_url(detection), headers: auth_headers(@user)

    assert_response :success
    detection.reload
    assert_predicate detection.cleaned_photo, :attached?
    assert_equal %w[original generated transparent], detection.image_versions.in_display_order.pluck(:variant_kind)
    assert_predicate detection.image_versions.find_by!(variant_kind: "transparent"), :selected?
    assert_match %r{/rails/active_storage/}, response_json["transparent_image_url"]

    post clothing_items_url, params: {
      clothing_item: {
        name: "Blue Denim Jacket",
        category: "jacket",
        size: "medium",
        tags: [ "blue", "denim", "jacket" ],
        source_outfit_detection_id: detection.id
      }
    }, headers: auth_headers(@user)

    assert_response :created
    created_item = ClothingItem.order(:created_at).last
    assert_equal %w[original generated transparent], created_item.image_versions.in_display_order.pluck(:variant_kind)
    assert_predicate created_item.image_versions.find_by!(variant_kind: "transparent"), :selected?
    assert_match %r{/rails/active_storage/}, response_json["original_image_url"]
    assert_match %r{/rails/active_storage/}, response_json["generated_image_url"]
    assert_match %r{/rails/active_storage/}, response_json["transparent_image_url"]
  end

  test "can generate metadata suggestions for an outfit detection" do
    upload = OutfitUpload.new(user: @user)
    upload.source_photo.attach(item_photo_upload)
    upload.status = :succeeded
    upload.provider = "openrouter"
    upload.vision_model = "openai/gpt-4.1-mini"
    upload.save!
    detection = upload.outfit_detections.create!(
      category: "jacket",
      confidence: 0.81,
      suggested_name: "Blue Denim Jacket",
      details: { dominant_color: "blue" },
      coarse_bbox_x: 0.1,
      coarse_bbox_y: 0.15,
      coarse_bbox_width: 0.3,
      coarse_bbox_height: 0.45,
      refined_bbox_x: 0.11,
      refined_bbox_y: 0.16,
      refined_bbox_width: 0.28,
      refined_bbox_height: 0.42,
      final_bbox_x: 0.12,
      final_bbox_y: 0.18,
      final_bbox_width: 0.26,
      final_bbox_height: 0.39,
      crop_status: :verified,
      crop_confidence: 0.84,
      crop_quality_score: 0.9,
      crop_attempts: 2,
      position: 0
    )

    captured = {}

    with_metadata_suggester_stub(capture: captured) do
      post generate_metadata_suggestions_outfit_detection_url(detection), params: {
        ai_context: {
          category: "jacket",
          name: "Blue Denim Jacket",
          brand: "Acme Atelier",
          tags: [ "blue", "denim", "jacket" ]
        }
      }, headers: auth_headers(@user)
    end

    assert_response :success
    assert_equal "jacket", response_json["category"]
    assert_equal "Blue Denim Jacket", response_json["name"]
    assert_equal "Acme Atelier", response_json["brand"]
    assert_equal [ "blue", "denim", "jacket" ], response_json["tags"]
    assert_equal "jacket", captured[:category_hint]
    assert_equal "jacket", captured.dig(:metadata_context, :category)
    assert_equal "Blue Denim Jacket", captured.dig(:metadata_context, :name)
    assert_equal 1, captured[:reference_photos].size
  end

  private

  def single_item_detector_response
    {
      provider: "openrouter",
      vision_model: "openai/gpt-4.1-mini",
      raw_response: { "id" => "resp_single" },
      items: [
        {
          category: "shirt",
          confidence: 0.92,
          suggested_name: "White Button-Up Shirt",
          coarse_box: { x: 0.12, y: 0.08, width: 0.38, height: 0.42 },
          details: { dominant_color: "white" }
        }
      ]
    }
  end

  def with_detector_stub(detector_response)
    detector_class = OutfitPhotoDetector.singleton_class
    original_detector = OutfitPhotoDetector.method(:call)

    detector_class.send(:define_method, :call) do |upload|
      detector_response.respond_to?(:call) ? detector_response.call(upload) : detector_response
    end

    yield
  ensure
    detector_class.send(:define_method, :call, original_detector)
  end

  def item_photo_upload
    Rack::Test::UploadedFile.new(file_fixture("item-photo.png"), "image/png")
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
        raw_response: { "id" => "img_456", "prompt_context" => prompt_context }
      }
    end

    yield
  ensure
    OpenrouterImageCleaner.singleton_class.send(:define_method, :call, original)
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
        category: category_hint.presence || metadata_context[:category] || "item",
        name: category_hint == "jacket" ? "Blue Denim Jacket" : "Suggested Item",
        brand: "Acme Atelier",
        tags: [ "blue", "denim", category_hint.presence || "item" ],
        provider: "openrouter",
        vision_model: "openai/gpt-4.1-mini"
      }
    end

    yield
  ensure
    OpenrouterMetadataSuggester.singleton_class.send(:define_method, :call, original)
  end

  def with_env(overrides)
    original_values = overrides.transform_values { |_, _| nil }
    overrides.each_key { |key| original_values[key] = ENV[key] }
    overrides.each { |key, value| ENV[key] = value }

    yield
  ensure
    original_values.each do |key, value|
      if value.nil?
        ENV.delete(key)
      else
        ENV[key] = value
      end
    end
  end
end
