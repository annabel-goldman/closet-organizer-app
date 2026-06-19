require "test_helper"

class OpenrouterMetadataSuggesterTest < ActiveSupport::TestCase
  test "normalizes item names with color first and title-style capitalization" do
    suggester = OpenrouterMetadataSuggester.new(
      Rack::Test::UploadedFile.new(file_fixture("item-photo.png"), "image/png")
    )

    normalized = suggester.send(
      :normalize_item_name,
      "ribbed beige tank top with buttons",
      tags: [ "beige", "ribbed", "tank top" ]
    )

    assert_equal "Beige Ribbed Tank Top with Buttons", normalized
  end

  test "prefixes a color from tags when the suggested name omits it" do
    suggester = OpenrouterMetadataSuggester.new(
      Rack::Test::UploadedFile.new(file_fixture("item-photo.png"), "image/png")
    )

    normalized = suggester.send(
      :normalize_item_name,
      "button-up shirt with lace",
      tags: [ "white", "cotton", "lace" ]
    )

    assert_equal "White Button-Up Shirt with Lace", normalized
  end

  test "titleizes v-neck names and preserves already-capitalized proper words" do
    suggester = OpenrouterMetadataSuggester.new(
      Rack::Test::UploadedFile.new(file_fixture("item-photo.png"), "image/png")
    )

    assert_equal "White V-Neck Shirt", suggester.send(:titleize_item_name, "white v-neck shirt")
    assert_equal "Brown The Stones Graphic Tee", suggester.send(:titleize_item_name, "Brown The Stones Graphic Tee")
  end

  test "request body applies a conservative default max tokens cap" do
    suggester = OpenrouterMetadataSuggester.new(
      Rack::Test::UploadedFile.new(file_fixture("item-photo.png"), "image/png")
    )

    body = suggester.send(:request_body)

    assert_equal 300, body[:max_tokens]
  end

  test "request body honors the metadata max tokens override" do
    original = ENV["OPENROUTER_METADATA_MAX_TOKENS"]
    ENV["OPENROUTER_METADATA_MAX_TOKENS"] = "220"

    suggester = OpenrouterMetadataSuggester.new(
      Rack::Test::UploadedFile.new(file_fixture("item-photo.png"), "image/png")
    )

    body = suggester.send(:request_body)

    assert_equal 220, body[:max_tokens]
  ensure
    ENV["OPENROUTER_METADATA_MAX_TOKENS"] = original
  end

  test "suggestion prompt instructs the model to put color first and use title capitalization" do
    suggester = OpenrouterMetadataSuggester.new(
      Rack::Test::UploadedFile.new(file_fixture("item-photo.png"), "image/png")
    )

    prompt = suggester.send(:suggestion_prompt)

    assert_includes prompt, "If a visible color is identifiable, include it first in the name."
    assert_includes prompt, "Use title capitalization for the name."
  end
end
