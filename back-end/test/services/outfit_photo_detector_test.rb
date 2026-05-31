require "test_helper"

class OutfitPhotoDetectorTest < ActiveSupport::TestCase
  test "request body applies a conservative default max tokens cap" do
    detector = OutfitPhotoDetector.new(OutfitUpload.new(user: users(:one), status: :pending))
    detector.singleton_class.send(:define_method, :source_photo_data_url) { "data:image/png;base64,abc123" }

    body = detector.send(
      :request_body,
      model: "openai/gpt-4.1-mini",
      prompt: "Detect visible items.",
      schema_name: "outfit_item_detection",
      schema: detector.send(:detection_schema)
    )

    assert_equal 500, body[:max_tokens]
  end

  test "request body honors the shared vision max tokens override" do
    original = ENV["OPENROUTER_VISION_MAX_TOKENS"]
    ENV["OPENROUTER_VISION_MAX_TOKENS"] = "360"

    detector = OutfitPhotoDetector.new(OutfitUpload.new(user: users(:one), status: :pending))
    detector.singleton_class.send(:define_method, :source_photo_data_url) { "data:image/png;base64,abc123" }

    body = detector.send(
      :request_body,
      model: "openai/gpt-4.1-mini",
      prompt: "Detect visible items.",
      schema_name: "outfit_item_detection",
      schema: detector.send(:detection_schema)
    )

    assert_equal 360, body[:max_tokens]
  ensure
    ENV["OPENROUTER_VISION_MAX_TOKENS"] = original
  end
end
