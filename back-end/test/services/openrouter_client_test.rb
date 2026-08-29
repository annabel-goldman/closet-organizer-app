require "test_helper"

class OpenrouterClientTest < ActiveSupport::TestCase
  test "builds authenticated JSON requests with optional app headers" do
    previous_site_url = ENV["OPENROUTER_SITE_URL"]
    previous_app_name = ENV["OPENROUTER_APP_NAME"]
    ENV["OPENROUTER_SITE_URL"] = "https://closet.example"
    ENV["OPENROUTER_APP_NAME"] = "Curated Closet"

    request = client.send(:build_request, "chat/completions", { model: "test/model" })

    assert_equal "Bearer test-key", request["Authorization"]
    assert_equal "application/json", request["Content-Type"]
    assert_equal "https://closet.example", request["HTTP-Referer"]
    assert_equal "Curated Closet", request["X-Title"]
    assert_equal({ "model" => "test/model" }, JSON.parse(request.body))
  ensure
    ENV["OPENROUTER_SITE_URL"] = previous_site_url
    ENV["OPENROUTER_APP_NAME"] = previous_app_name
  end

  test "normalizes unreadable provider responses" do
    fake_http = Object.new
    fake_http.define_singleton_method(:request) do |_request|
      Struct.new(:body).new("not-json")
    end
    service = client
    service.define_singleton_method(:http_for) { |_path| fake_http }

    error = assert_raises(RuntimeError) do
      service.post_json(path: "chat/completions", body: {}, unreadable_message: "Unreadable test response.")
    end

    assert_equal "Unreadable test response.", error.message
  end

  private

  def client
    OpenrouterClient.new(
      api_key: "test-key",
      base_url: "https://openrouter.example/api/v1",
      read_timeout: 35
    )
  end
end
