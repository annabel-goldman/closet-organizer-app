require "json"
require "net/http"
require "uri"

class OpenrouterClient
  def initialize(api_key:, base_url:, read_timeout:, open_timeout: 10)
    @api_key = api_key
    @base_url = base_url
    @read_timeout = read_timeout
    @open_timeout = open_timeout
  end

  def post_json(path:, body:, unreadable_message: "OpenRouter returned an unreadable response.")
    response = http_for(path).request(build_request(path, body))
    parsed = JSON.parse(response.body)
    return parsed if response.is_a?(Net::HTTPSuccess)

    raise(parsed.dig("error", "message") || "OpenRouter request failed with status #{response.code}")
  rescue JSON::ParserError
    raise unreadable_message
  end

  private

  attr_reader :api_key, :base_url, :open_timeout, :read_timeout

  def endpoint(path)
    URI.parse("#{base_url.to_s.sub(%r{/\z}, "")}/#{path.to_s.sub(%r{\A/}, "")}")
  end

  def http_for(path)
    uri = endpoint(path)
    Net::HTTP.new(uri.host, uri.port).tap do |http|
      http.use_ssl = (uri.scheme == "https")
      http.read_timeout = read_timeout
      http.open_timeout = open_timeout
    end
  end

  def build_request(path, body)
    Net::HTTP::Post.new(endpoint(path)).tap do |request|
      request["Authorization"] = "Bearer #{api_key}"
      request["Content-Type"] = "application/json"
      request["HTTP-Referer"] = ENV["OPENROUTER_SITE_URL"] if ENV["OPENROUTER_SITE_URL"].present?
      request["X-Title"] = ENV["OPENROUTER_APP_NAME"] if ENV["OPENROUTER_APP_NAME"].present?
      request.body = body.to_json
    end
  end
end
