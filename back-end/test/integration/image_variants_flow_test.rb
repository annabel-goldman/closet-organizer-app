require "test_helper"

class ImageVariantsFlowTest < ActionDispatch::IntegrationTest
  setup do
    @user = users(:one)
  end

  test "can create a cleaned preview image from an uploaded file" do
    captured = {}

    with_image_cleaner_stub(capture: captured) do
      post preview_image_variants_url, params: {
        image_variant: {
          source_photo: item_photo_upload,
          original_source_photo: item_photo_upload
        },
        ai_context: {
          category: "shirt",
          name: "Striped Shirt",
          brand: "Acme",
          size: "medium",
          tags: [ "striped", "cotton", "shirt" ]
        }
      }, headers: auth_headers(@user)
    end

    assert_response :success
    assert_equal "preview-photo.png", response_json["filename"]
    assert_equal "image/png", response_json["content_type"]
    assert_match(/\Adata:image\/png;base64,/, response_json["data_url"])
    assert_equal "Striped Shirt", captured.dig(:metadata_context, :name)
    assert_equal "Acme", captured.dig(:metadata_context, :brand)
    assert_equal [ "striped", "cotton", "shirt" ], captured.dig(:metadata_context, :tags)
  end

  test "can create a transparent preview image from a cleaned upload" do
    transparent_calls = []

    with_transparent_generator_stub(calls: transparent_calls) do
      post transparent_preview_image_variants_url, params: {
        image_variant: {
          source_photo: item_photo_upload
        }
      }, headers: auth_headers(@user)
    end

    assert_response :success
    assert_equal "item-photo-transparent.png", response_json["filename"]
    assert_equal "image/png", response_json["content_type"]
    assert_match(/\Adata:image\/png;base64,/, response_json["data_url"])
    assert_equal 1, transparent_calls.size
    assert_equal "item-photo", transparent_calls.first[:filename_root]
  end

  test "can create metadata suggestions from an uploaded file" do
    captured = {}

    with_metadata_suggester_stub(capture: captured) do
      post metadata_suggestions_image_variants_url, params: {
        image_variant: {
          source_photo: item_photo_upload,
          original_source_photo: item_photo_upload,
          category_hint: "shirt"
        },
        ai_context: {
          category: "shirt",
          name: "Striped Shirt",
          brand: "Acme",
          tags: [ "striped", "cotton", "shirt" ]
        }
      }, headers: auth_headers(@user)
    end

    assert_response :success
    assert_equal "shirt", response_json["category"]
    assert_equal "Striped Cotton Shirt", response_json["name"]
    assert_equal "Acme", response_json["brand"]
    assert_equal [ "striped", "cotton", "shirt" ], response_json["tags"]
    assert_equal "shirt", captured[:category_hint]
    assert_equal "shirt", captured.dig(:metadata_context, :category)
    assert_equal "Striped Shirt", captured.dig(:metadata_context, :name)
    assert_equal "Acme", captured.dig(:metadata_context, :brand)
  end

  private

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

      tempfile = Tempfile.new([ "preview-photo", ".png" ])
      tempfile.binmode
      tempfile.write(File.binread(fixture_path))
      tempfile.rewind

      {
        tempfile: tempfile,
        filename: "preview-photo.png",
        filename_root: "preview-photo",
        content_type: "image/png",
        provider: "openrouter",
        model: "google/gemini-2.5-flash-image",
        raw_response: { "id" => "img_preview", "prompt_context" => prompt_context }
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
        category: category_hint.presence || metadata_context[:category] || "top",
        name: "Striped Cotton #{category_hint.to_s.titleize}".strip,
        brand: "Acme",
        tags: [ "striped", "cotton", category_hint.presence || "top" ],
        provider: "openrouter",
        vision_model: "openai/gpt-4.1-mini"
      }
    end

    yield
  ensure
    OpenrouterMetadataSuggester.singleton_class.send(:define_method, :call, original)
  end

  def with_transparent_generator_stub(calls: [])
    original = TransparentPngVariantGenerator.method(:call)
    fixture_path = file_fixture("item-photo.png")

    TransparentPngVariantGenerator.singleton_class.send(:define_method, :call) do |image_source, filename_root:, temporary_files: []|
      calls << {
        filename_root: filename_root,
        image_source_class: image_source.class.name
      }

      tempfile = ManagedTempfiles.wrap(temporary_files).track(
        Tempfile.new([ "#{filename_root}-transparent", ".png" ])
      )
      tempfile.binmode
      tempfile.write(File.binread(fixture_path))
      tempfile.rewind

      {
        tempfile: tempfile,
        filename: "#{filename_root}-transparent.png",
        content_type: "image/png"
      }
    end

    yield
  ensure
    TransparentPngVariantGenerator.singleton_class.send(:define_method, :call, original)
  end
end
