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
end
