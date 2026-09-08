class OutfitPhotoDetector < OpenrouterVisionService
  DEFAULT_MODEL = "openai/gpt-4.1-mini".freeze
  CATEGORY_ALIASES = {
    "bracelet" => "accessory",
    "bracelets" => "accessory",
    "brooch" => "accessory",
    "earring" => "accessory",
    "earrings" => "accessory",
    "jewelry" => "accessory",
    "jewellery" => "accessory",
    "necklace" => "accessory",
    "pendant" => "accessory",
    "ring" => "accessory",
    "watch" => "accessory"
  }.freeze

  def self.call(outfit_upload)
    new(outfit_upload).call
  end

  def initialize(outfit_upload)
    @outfit_upload = outfit_upload
  end

  def call
    parsed = perform_structured_request(
      model: configured_model,
      prompt: detection_prompt,
      schema_name: "outfit_item_detection",
      schema: detection_schema
    )

    {
      provider: "openrouter",
      vision_model: configured_model,
      items: normalize_items(parsed.fetch("items", [])),
      raw_response: last_raw_response
    }
  end

  private

  def detection_prompt
    <<~PROMPT
      Analyze this outfit photo and identify the visible clothing items and accessories that should become separate closet entries.

      Return a JSON object with this shape:
      {
        "items": [
          {
            "category": "shirt",
            "confidence": 0.93,
            "visible": true,
            "single_item_visible": true,
            "suggested_name": "White Button-Up Shirt",
            "coarse_box": {
              "x": 0.18,
              "y": 0.12,
              "width": 0.34,
              "height": 0.41
            },
            "dominant_color": "white",
            "material_guess": "cotton",
            "style_guess": "classic",
            "appearance_summary": "White cotton button-up shirt with a classic silhouette and visible long sleeves.",
            "notes": "Any short note that helps explain the item."
          }
        ]
      }

      Rules:
      - Include only items that are clearly visible enough to be useful.
      - Use short, normalized categories like shirt, blouse, jacket, coat, pants, jeans, shorts, skirt, dress, belt, shoes, hat, bag.
      - Return one closet-worthy item per entry.
      - Confidence must be a number from 0 to 1.
      - single_item_visible should be true only when the item can plausibly become its own saved closet image.
      - coarse_box values must be normalized decimals from 0 to 1 relative to the full image.
      - coarse_box may be slightly loose, but it must contain the full item.
      - If material or style is unclear, use an empty string.
      - appearance_summary should be one short natural-language description of the item's look, including any useful silhouette, graphic, neckline, sleeve, or fit details you can see.
      - Return only JSON and no markdown.
    PROMPT
  end

  def detection_schema
    {
      type: "object",
      additionalProperties: false,
      required: [ "items" ],
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: %w[
              category
              confidence
              visible
              single_item_visible
              suggested_name
              coarse_box
              dominant_color
              material_guess
              style_guess
              appearance_summary
              notes
            ],
            properties: {
              category: { type: "string" },
              confidence: unit_interval_schema,
              visible: { type: "boolean" },
              single_item_visible: { type: "boolean" },
              suggested_name: { type: "string" },
              coarse_box: box_schema,
              dominant_color: { type: "string" },
              material_guess: { type: "string" },
              style_guess: { type: "string" },
              appearance_summary: { type: "string" },
              notes: { type: "string" }
            }
          }
        }
      }
    }
  end

  def normalize_items(items)
    Array(items).filter_map do |item|
      next if item["visible"] == false

      category = normalize_category(item["category"])
      next if category.blank?

      {
        category: category,
        confidence: normalize_confidence(item["confidence"]),
        single_item_visible: item["single_item_visible"] == true,
        suggested_name: item["suggested_name"].to_s.strip.presence,
        coarse_box: normalize_box(item["coarse_box"]),
        details: {
          dominant_color: item["dominant_color"].to_s.strip,
          material_guess: item["material_guess"].to_s.strip,
          style_guess: item["style_guess"].to_s.strip,
          appearance_summary: item["appearance_summary"].to_s.strip,
          notes: item["notes"].to_s.strip
        }.compact_blank
      }
    end
  end

  def normalize_category(value)
    normalized = value.to_s.strip.downcase.squish
    CATEGORY_ALIASES.fetch(normalized, normalized)
  end

  def normalize_confidence(value)
    Float(value)
  rescue ArgumentError, TypeError
    nil
  end

  def configured_model
    ENV.fetch("OPENROUTER_DETECTION_MODEL", ENV.fetch("OPENROUTER_MODEL", DEFAULT_MODEL))
  end
end
