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

    assert_equal 900, body[:max_tokens]
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

  test "retries with a larger token budget when structured detection JSON is truncated" do
    detector = OutfitPhotoDetector.new(OutfitUpload.new(user: users(:one), status: :pending))
    detector.singleton_class.send(:define_method, :ensure_configuration!) { nil }
    detector.singleton_class.send(:define_method, :source_photo_data_url) { "data:image/png;base64,abc123" }

    recorded_max_tokens = []
    responses = [
      {
        "choices" => [
          {
            "message" => {
              "content" => "{\"items\":[{\"category\":\"shirt\""
            }
          }
        ]
      },
      {
        "choices" => [
          {
            "message" => {
              "content" => "{\"items\":[]}"
            }
          }
        ]
      }
    ]

    detector.singleton_class.send(:define_method, :perform_request) do |body|
      recorded_max_tokens << body[:max_tokens]
      responses.shift
    end

    result = detector.call

    assert_equal [], result[:items]
    assert_equal [ 900, 1800 ], recorded_max_tokens
  end
end
