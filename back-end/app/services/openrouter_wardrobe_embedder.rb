require "base64"

class OpenrouterWardrobeEmbedder
  DEFAULT_MODEL = "google/gemini-embedding-2".freeze
  DEFAULT_DIMENSIONS = 768

  def self.same_model?(left, right)
    left_identifier = canonical_model_identifier(left)
    right_identifier = canonical_model_identifier(right)
    left_identifier.present? && left_identifier == right_identifier
  end

  def self.canonical_model_identifier(model)
    model.to_s.strip.split("/").last.presence
  end

  def self.embed_item(item, attachment: item.display_photo_attachment)
    new.embed_item(item, attachment: attachment)
  end

  def self.embed_query(query)
    new.embed_query(query)
  end

  def embed_item(item, attachment:)
    raise "This closet item does not have an image to analyze." unless attachment.attached?

    input = attachment.blob.open do |file|
      data_url = "data:#{attachment.blob.content_type || 'image/png'};base64,#{Base64.strict_encode64(File.binread(file.path))}"
      [
        {
          content: [
            { type: "text", text: item_document(item) },
            { type: "image_url", image_url: { url: data_url } }
          ]
        }
      ]
    end
    request_embedding(input, input_type: "search_document")
  end

  def embed_query(query)
    request_embedding("task: search result | query: #{query.to_s.squish}", input_type: "search_query")
  end

  private

  def request_embedding(input, input_type:)
    response = client.post_json(
      path: "/embeddings",
      body: {
        model: configured_model,
        input: input,
        input_type: input_type,
        dimensions: configured_dimensions,
        encoding_format: "float"
      },
      unreadable_message: "OpenRouter returned an unreadable embedding response."
    )
    embedding = response.dig("data", 0, "embedding")
    raise "OpenRouter did not return an embedding." unless embedding.is_a?(Array) && embedding.any?

    {
      embedding: embedding.map(&:to_f),
      provider: "openrouter",
      model: response["model"].presence || configured_model,
      usage: response["usage"] || {}
    }
  end

  def item_document(item)
    [
      "title: #{item.name}",
      "category: #{item.category}",
      ("brand: #{item.brand}" if item.brand.present?),
      ("size: #{item.size}" if item.size.present?),
      ("tags: #{TagListNormalizer.call(item.tags).join(', ')}" if item.tags.present?),
      ("visual description: #{item.style_notes}" if item.style_notes.present?)
    ].compact.join(" | ")
  end

  def client
    @client ||= OpenrouterClient.new(
      api_key: api_key,
      base_url: ENV.fetch("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
      read_timeout: 120
    )
  end

  def api_key
    ENV["OPENROUTER_API_KEY"].presence || raise("OPENROUTER_API_KEY is not configured.")
  end

  def configured_model
    ENV.fetch("OPENROUTER_EMBEDDING_MODEL", DEFAULT_MODEL)
  end

  def configured_dimensions
    Integer(ENV.fetch("OPENROUTER_EMBEDDING_DIMENSIONS", DEFAULT_DIMENSIONS))
  end
end
