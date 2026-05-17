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

    with_crop_pipeline_stubs(
      detector_response: detector_response,
      refinement_response: {
        refined_box: {
          x: 0.14,
          y: 0.1,
          width: 0.32,
          height: 0.39
        },
        crop_confidence: 0.87,
        notes: "Tightened around the shirt."
      },
      verification_response: {
        accepted: true,
        quality_score: 0.91,
        issues: [],
        notes: "Verified for saving.",
        final_box: {
          x: 0.15,
          y: 0.11,
          width: 0.3,
          height: 0.37
        }
      }
    ) do
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
      assert_equal 0.14, response_json["detections"].first["refined_box"]["x"]
      assert_equal 0.15, response_json["detections"].first["final_box"]["x"]
    end
  end

  test "returns a failed upload payload after async detection raises an error" do
    with_crop_pipeline_stubs(detector_response: ->(_upload) { raise "OPENROUTER_API_KEY is not configured." }) do
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

  test "retries refinement when the first crop is rejected" do
    detector_response = {
      provider: "openrouter",
      vision_model: "openai/gpt-4.1-mini",
      raw_response: { "id" => "resp_retry" },
      items: [
        {
          category: "sweatshirt",
          confidence: 0.9,
          suggested_name: "Gray Crewneck Sweatshirt",
          coarse_box: {
            x: 0.1,
            y: 0.1,
            width: 0.5,
            height: 0.5
          },
          single_item_visible: true,
          details: {
            dominant_color: "gray",
            material_guess: "cotton",
            style_guess: "casual",
            notes: "Relaxed fit sweatshirt."
          }
        }
      ]
    }

    refinement_responses = [
      {
        refined_box: { x: 0.14, y: 0.12, width: 0.24, height: 0.2 },
        crop_confidence: 0.5,
        notes: "First attempt."
      },
      {
        refined_box: { x: 0.1, y: 0.11, width: 0.38, height: 0.4 },
        crop_confidence: 0.84,
        notes: "Second attempt widened the crop."
      }
    ]
    verification_responses = [
      {
        accepted: false,
        quality_score: 0.41,
        issues: [ "cut_off_item" ],
        notes: "Sleeve is cropped out.",
        final_box: { x: 0.14, y: 0.12, width: 0.24, height: 0.2 }
      },
      {
        accepted: true,
        quality_score: 0.9,
        issues: [],
        notes: "Verified after retry.",
        final_box: { x: 0.11, y: 0.11, width: 0.36, height: 0.39 }
      }
    ]

    with_env("OUTFIT_CROP_CYCLE_LIMIT" => "2") do
      with_crop_pipeline_stubs(
        detector_response: detector_response,
        refinement_response: ->(_detection) { refinement_responses.shift },
        verification_response: ->(_detection) { verification_responses.shift }
      ) do
        post outfit_uploads_url, params: {
          outfit_upload: {
            user_id: @user.id,
            source_photo: item_photo_upload
          }
        }, headers: auth_headers(@user)

        assert_response :created
        upload_id = response_json["id"]

        perform_enqueued_jobs only: OutfitUploadAnalysisJob

        get outfit_upload_url(upload_id), headers: auth_headers(@user), as: :json

        assert_response :success
        detection = response_json["detections"].first
        assert_not detection.key?("crop_status")
        assert_equal 0.11, detection["final_box"]["x"]
      end
    end
  end

  test "can generate a clean image for an outfit detection" do
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
      post generate_clean_image_outfit_detection_url(detection), params: {
        ai_context: {
          name: "Blue Denim Jacket",
          brand: "Acme Atelier",
          tags: [ "blue", "denim", "jacket" ]
        }
      }, headers: auth_headers(@user)
    end

    assert_response :success

    detection.reload
    assert_predicate detection.cleaned_photo, :attached?
    assert_equal "succeeded", response_json["clean_image_status"]
    assert_match %r{/rails/active_storage/}, response_json["cleaned_image_url"]
    assert_equal "Blue Denim Jacket", captured.dig(:metadata_context, :name)
    assert_equal "Acme Atelier", captured.dig(:metadata_context, :brand)
    assert_equal 1, captured[:reference_photos].size
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

  def with_crop_pipeline_stubs(detector_response:, refinement_response: nil, verification_response: nil)
    detector_class = OutfitPhotoDetector.singleton_class
    refiner_class = OutfitCropRefiner.singleton_class
    verifier_class = OutfitCropVerifier.singleton_class
    original_detector = OutfitPhotoDetector.method(:call)
    original_refiner = OutfitCropRefiner.method(:call)
    original_verifier = OutfitCropVerifier.method(:call)
    invoke_response = lambda do |callable, detection, kwargs = {}|
      parameters = callable.parameters
      accepts_keywords = parameters.any? { |kind, _| %i[key keyreq keyrest].include?(kind) }
      accepts_second_positional = parameters.count { |kind, _| %i[opt req rest].include?(kind) } > 1

      if accepts_keywords && kwargs.present?
        callable.call(detection, **kwargs)
      elsif accepts_second_positional && kwargs.present?
        callable.call(detection, kwargs)
      else
        callable.call(detection)
      end
    end

    detector_class.send(:define_method, :call) do |upload|
      detector_response.respond_to?(:call) ? detector_response.call(upload) : detector_response
    end

    refiner_class.send(:define_method, :call) do |*args, **kwargs|
      _upload, detection = args
      if refinement_response.respond_to?(:call)
        invoke_response.call(refinement_response, detection, kwargs)
      else
        refinement_response
      end
    end if refinement_response

    verifier_class.send(:define_method, :call) do |*args, **_kwargs|
      _upload, detection = args
      verification_response.respond_to?(:call) ? invoke_response.call(verification_response, detection) : verification_response
    end if verification_response

    yield
  ensure
    detector_class.send(:define_method, :call, original_detector)
    refiner_class.send(:define_method, :call, original_refiner)
    verifier_class.send(:define_method, :call, original_verifier)
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
