require "test_helper"

class OpenrouterImageCleanerTest < ActiveSupport::TestCase
  test "prompt preserves jewelry presentation boxes and cases" do
    cleaner = OpenrouterImageCleaner.new(
      Object.new,
      prompt_context: {
        name: "Gold Earrings",
        category: "accessory",
        appearance_summary: "Gold earrings sitting inside a red Cartier jewelry box."
      },
      metadata_context: {
        category: "accessory",
        brand: "Cartier",
        style_notes: "Keep the earrings inside the Cartier box."
      }
    )

    prompt = cleaner.send(:generation_prompt)

    assert_includes prompt, "preserve any visible branded box, tray, pouch, case, packaging, or display holder"
    assert_includes prompt, "Do not treat a jewelry box, branded case, display tray, or storage pouch as removable clutter"
    assert_includes prompt, "Product presentation constraints:"
    assert_includes prompt, "keep the item inside that Cartier presentation box/case"
  end

  test "prompt does not add product presentation constraints for ordinary garments" do
    cleaner = OpenrouterImageCleaner.new(
      Object.new,
      prompt_context: {
        name: "Ivory Silk Blouse",
        category: "top",
        appearance_summary: "Ivory silk blouse with long sleeves."
      },
      metadata_context: {
        category: "top",
        style_notes: "Soft drape with a workwear feel."
      }
    )

    prompt = cleaner.send(:generation_prompt)

    assert_not_includes prompt, "Product presentation constraints:"
  end

  test "modeled outfit prompt describes every outfit piece and the private reference" do
    cleaner = OpenrouterImageCleaner.new(
      Object.new,
      mode: :modeled_outfit,
      prompt_context: {
        name: "Dinner Look",
        notes: "A polished evening outfit.",
        items: [
          { name: "Black Blazer", category: "outerwear", style: "Structured", tags: [ "polished" ] },
          { name: "Silk Cami", category: "top", style: "Soft drape", tags: [ "silk" ] }
        ]
      },
      reference_photos: [
        { photo: Object.new, label: "Private model reference photo 1 of 2:" },
        { photo: Object.new, label: "Private model reference photo 2 of 2:" }
      ]
    )

    prompt = cleaner.send(:generation_prompt)

    assert_includes prompt, "complete outfit represented by the garment reference images"
    assert_includes prompt, "1. Black Blazer; category: outerwear; style: Structured; tags: polished"
    assert_includes prompt, "2. Silk Cami; category: top; style: Soft drape; tags: silk"
    assert_includes prompt, "Do not add unreferenced clothing, shoes, bags, jewelry, or other accessories."
    assert_includes prompt, "vertical 4:5 portrait image, never landscape or square"
    assert_includes prompt, "Frame the person head to toe with the complete outfit visible"
    assert_includes prompt, "The first 2 input reference images are private photos of the same person"
    assert_includes prompt, "The next 2 input reference images are the outfit pieces"
    assert_includes prompt, "solid pure white (#FFFFFF) background like a clean full-body cutout"
    assert_includes prompt, "every background pixel uniformly white"
    assert_includes prompt, "Do not add a cast shadow, contact shadow, reflection, halo, glow, or grounding surface"
    assert_includes prompt, "color-selection magic wand can remove the white background easily"
    assert_includes prompt, "white background opaque rather than transparent"
  end

  test "modeled item prompt requires an isolated cutout on a solid white background" do
    cleaner = OpenrouterImageCleaner.new(
      Object.new,
      mode: :modeled,
      prompt_context: {
        name: "Black Blazer",
        category: "outerwear"
      }
    )

    prompt = cleaner.send(:generation_prompt)

    assert_includes prompt, "solid pure white (#FFFFFF) background like a clean full-body cutout"
    assert_includes prompt, "vertical 4:5 portrait image, never landscape or square"
    assert_includes prompt, "vertical composition that keeps the referenced item fully visible"
    assert_includes prompt, "every background pixel uniformly white"
    assert_includes prompt, "Do not add a cast shadow, contact shadow, reflection, halo, glow, or grounding surface"
    assert_includes prompt, "color-selection magic wand can remove the white background easily"
    assert_includes prompt, "white background opaque rather than transparent"
  end

  test "modeled preview requests use the app's portrait canvas ratio" do
    modeled_cleaner = OpenrouterImageCleaner.new(Object.new, mode: :modeled_outfit)
    catalog_cleaner = OpenrouterImageCleaner.new(Object.new, mode: :catalog)

    modeled_body = modeled_cleaner.send(
      :image_request_body,
      model: "bytedance-seed/seedream-4.5",
      prompt: "portrait preview",
      input_data_urls: %w[data:image/png;base64,person data:image/png;base64,outfit]
    )
    catalog_body = catalog_cleaner.send(
      :request_body,
      model: "google/gemini-2.5-flash-image",
      prompt: "catalog image",
      data_url: "data:image/png;base64,abc"
    )

    assert_equal "bytedance-seed/seedream-4.5", modeled_body[:model]
    assert_equal "2K", modeled_body[:resolution]
    assert_equal "4:5", modeled_body[:aspect_ratio]
    assert_equal "png", modeled_body[:output_format]
    assert_equal 2, modeled_body[:input_references].length
    assert_not catalog_body.key?(:image_config)
  end

  test "modeled outfit image references put private identity photos before outfit pieces" do
    cleaner = OpenrouterImageCleaner.new(
      Object.new,
      mode: :modeled_outfit,
      reference_photos: [
        { photo: "outfit-two", label: "Outfit piece 2:" },
        { photo: "styled-flatlay", label: "Styled flat-lay composition reference (use for styling and layering, not garment identity):" },
        { photo: "person-primary", label: "Private model reference photo 1 of 2:" },
        { photo: "person-side", label: "Private model reference photo 2 of 2:" }
      ]
    )

    cleaner.define_singleton_method(:photo_data_url) { |photo| "data:image/png;base64,#{photo}" }

    assert_equal [
      "data:image/png;base64,person-primary",
      "data:image/png;base64,person-side",
      "data:image/png;base64,outfit-one",
      "data:image/png;base64,outfit-two",
      "data:image/png;base64,styled-flatlay"
    ], cleaner.send(:modeled_outfit_input_data_urls, "data:image/png;base64,outfit-one")
  end

  test "modeled outfit prompt uses a styled flatlay as composition guidance" do
    cleaner = OpenrouterImageCleaner.new(
      Object.new,
      mode: :modeled_outfit,
      prompt_context: {
        name: "Layered Look",
        items: [ { name: "Open Blazer", category: "outerwear" } ]
      },
      reference_photos: [
        { photo: Object.new, label: "Styled flat-lay composition reference (use for styling and layering, not garment identity):" }
      ]
    )

    prompt = cleaner.send(:generation_prompt)

    assert_includes prompt, "final input reference image is the user's styled flat-lay composition"
    assert_includes prompt, "layering order"
    assert_includes prompt, "open or closed outerwear"
    assert_includes prompt, "Do not copy the flat-lay's literal two-dimensional positions"
    assert_includes prompt, "flat lay is composition guidance and must not introduce a new garment"
  end

  test "extracts dedicated Images API responses" do
    cleaner = OpenrouterImageCleaner.new(Object.new, mode: :modeled_outfit)

    assert_equal(
      "data:image/webp;base64,generated-bytes",
      cleaner.send(
        :extract_image_api_data_url,
        { "data" => [ { "b64_json" => "generated-bytes", "media_type" => "image/webp" } ] }
      )
    )
  end
end
