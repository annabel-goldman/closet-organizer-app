require "base64"
require "json"
require "image_processing/mini_magick"

class OpenrouterWardrobeEnricher
  DEFAULT_MODEL = "google/gemini-2.5-flash-lite".freeze

  def self.call(item, attachment: item.display_photo_attachment)
    new(item, attachment: attachment).call
  end

  def initialize(item, attachment:)
    @item = item
    @attachment = attachment
  end

  def call
    raise "This closet item does not have an image to enrich." unless attachment.attached?

    response = client.post_json(
      path: "/chat/completions",
      body: request_body,
      unreadable_message: "OpenRouter returned an unreadable wardrobe enrichment response."
    )
    {
      attributes: parse_content(response),
      provider: "openrouter",
      model: response["model"].presence || configured_model,
      usage: response["usage"] || {}
    }
  end

  private

  attr_reader :attachment, :item

  def request_body
    {
      model: configured_model,
      temperature: 0.1,
      max_tokens: 700,
      response_format: {
        type: "json_schema",
        json_schema: { name: "wardrobe_visual_enrichment", strict: true, schema: response_schema }
      },
      messages: [
        { role: "system", content: "You analyze visible fashion attributes. Return only valid JSON." },
        { role: "user", content: request_content }
      ]
    }
  end

  def request_content
    [
      {
        type: "text",
        text: <<~PROMPT
          Analyze the single closet item in this image. Use only visible evidence and the supplied catalog context.
          Return concise normalized attributes useful for composing complete outfits. Scores use 1 (low) through 5 (high).
          Catalog context: #{item.name}; category #{item.category}; #{item.style_notes}
        PROMPT
      },
      { type: "image_url", image_url: { url: data_url } }
    ]
  end

  def response_schema
    {
      type: "object",
      additionalProperties: false,
      required: %w[silhouette fit length neckline patterns textures materials visual_weight warmth formality statement_role color_proportions],
      properties: {
        silhouette: { type: "string" },
        fit: { type: "string" },
        length: { type: "string" },
        neckline: { type: "string" },
        patterns: { type: "array", items: { type: "string" }, maxItems: 4 },
        textures: { type: "array", items: { type: "string" }, maxItems: 4 },
        materials: { type: "array", items: { type: "string" }, maxItems: 4 },
        visual_weight: { type: "integer", minimum: 1, maximum: 5 },
        warmth: { type: "integer", minimum: 1, maximum: 5 },
        formality: { type: "integer", minimum: 1, maximum: 5 },
        statement_role: { type: "string", enum: %w[basic supporting statement] },
        color_proportions: {
          type: "array",
          maxItems: 5,
          items: {
            type: "object",
            additionalProperties: false,
            required: %w[name proportion],
            properties: {
              name: { type: "string" },
              proportion: { type: "number", minimum: 0, maximum: 1 }
            }
          }
        }
      }
    }
  end

  def data_url
    attachment.blob.open do |file|
      prepared = ImageProcessing::MiniMagick.source(file.path).resize_to_limit(512, 512).convert("png").call
      begin
        encoded = Base64.strict_encode64(File.binread(prepared.path))
        return "data:image/png;base64,#{encoded}"
      ensure
        prepared.close!
      end
    end
  end

  def parse_content(response)
    content = response.dig("choices", 0, "message", "content")
    content = content.filter_map { |part| part["text"] }.join("\n") if content.is_a?(Array)
    cleaned = content.to_s.strip.sub(/\A```json\s*/i, "").sub(/\A```\s*/i, "").sub(/\s*```\z/, "")
    JSON.parse(cleaned)
  rescue JSON::ParserError
    raise "OpenRouter returned wardrobe enrichment data that was not valid JSON."
  end

  def client
    @client ||= OpenrouterClient.new(
      api_key: ENV["OPENROUTER_API_KEY"].presence || raise("OPENROUTER_API_KEY is not configured."),
      base_url: ENV.fetch("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
      read_timeout: 120
    )
  end

  def configured_model
    ENV.fetch("OPENROUTER_ENRICHMENT_MODEL", DEFAULT_MODEL)
  end
end
