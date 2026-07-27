require "test_helper"

class OpenrouterOutfitReferenceAnalyzerTest < ActiveSupport::TestCase
  test "normalizes structured reference profile responses" do
    analyzer = OpenrouterOutfitReferenceAnalyzer.new(reference_photo: reference_photo_upload)
    analyzer.define_singleton_method(:perform_structured_request) do
      {
        "overall_style" => [ "Casual Glam", "casual glam" ],
        "target_slots" => [
          {
            "role" => "top",
            "required" => true,
            "subtype" => "hoodie",
            "colors" => [ "Olive", "Dark Green" ],
            "materials" => [ "Sweatshirt Fleece" ],
            "visual_features" => [ "Wing Graphic", "Rhinestones" ],
            "weight" => 1.5
          }
        ]
      }
    end

    with_openrouter_key do
      profile = analyzer.call

      assert_equal [ "casual glam" ], profile["overall_style"]
      assert_equal "hoodie", profile.dig("target_slots", 0, "subtype")
      assert_equal true, profile.dig("target_slots", 0, "required")
      assert_equal [ "olive", "dark green" ], profile.dig("target_slots", 0, "colors")
      assert_equal 1.0, profile.dig("target_slots", 0, "weight")
    end
  end

  test "includes the reference flatlay image in request content" do
    analyzer = OpenrouterOutfitReferenceAnalyzer.new(reference_photo: reference_photo_upload)

    serialized = analyzer.send(:request_content).to_json

    assert_includes serialized, "Reference flatlay outfit image"
    assert_includes serialized, "wings"
    assert_includes serialized, "data:image/png;base64,"
  end

  private

  def reference_photo_upload
    Rack::Test::UploadedFile.new(Rails.root.join("test/fixtures/files/item-photo.png"), "image/png")
  end

  def with_openrouter_key
    original = ENV["OPENROUTER_API_KEY"]
    ENV["OPENROUTER_API_KEY"] = "test-key"
    yield
  ensure
    ENV["OPENROUTER_API_KEY"] = original
  end
end
