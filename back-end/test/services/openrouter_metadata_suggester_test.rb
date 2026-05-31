require "test_helper"

class OpenrouterMetadataSuggesterTest < ActiveSupport::TestCase
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
end
