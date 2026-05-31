require "test_helper"

class OpenrouterImageCleanerTest < ActiveSupport::TestCase
  test "generation prompt tells the model to choose white or charcoal based on garment contrast" do
    cleaner = OpenrouterImageCleaner.new(
      Rack::Test::UploadedFile.new(file_fixture("item-photo.png"), "image/png"),
      metadata_context: {
        category: "shirt",
        name: "Ivory Shirt"
      }
    )

    prompt = cleaner.send(:generation_prompt)

    assert_includes prompt, "only one of these two options: paper white or deep charcoal"
    assert_includes prompt, "If the garment is light-colored, close to white"
    assert_includes prompt, "Otherwise choose a paper-white background"
    assert_includes prompt, "flat and uniform from edge to edge"
    assert_includes prompt, "Leave a clear visible margin of background"
    assert_includes prompt, "Do not substitute a different background color"
    assert_includes prompt, "Do not add any cast shadow"
    assert_includes prompt, "Minimize harsh shadows, deep shading, and strong contrast on the garment itself"
    assert_includes prompt, "avoid dark shadowed regions on the garment that could blend into the background"
    assert_includes prompt, "no gradient, texture, wrinkles, floor line"
    assert_includes prompt, "Category: shirt"
  end

  test "request body applies a conservative default max tokens cap" do
    cleaner = OpenrouterImageCleaner.new(
      Rack::Test::UploadedFile.new(file_fixture("item-photo.png"), "image/png")
    )

    body = cleaner.send(
      :request_body,
      model: "google/gemini-2.5-flash-image",
      prompt: "Clean this image.",
      data_url: "data:image/png;base64,abc123"
    )

    assert_equal 300, body[:max_tokens]
  end

  test "request body honors the image cleaner max tokens override" do
    original = ENV["OPENROUTER_IMAGE_CLEAN_MAX_TOKENS"]
    ENV["OPENROUTER_IMAGE_CLEAN_MAX_TOKENS"] = "180"

    cleaner = OpenrouterImageCleaner.new(
      Rack::Test::UploadedFile.new(file_fixture("item-photo.png"), "image/png")
    )

    body = cleaner.send(
      :request_body,
      model: "google/gemini-2.5-flash-image",
      prompt: "Clean this image.",
      data_url: "data:image/png;base64,abc123"
    )

    assert_equal 180, body[:max_tokens]
  ensure
    ENV["OPENROUTER_IMAGE_CLEAN_MAX_TOKENS"] = original
  end
end
