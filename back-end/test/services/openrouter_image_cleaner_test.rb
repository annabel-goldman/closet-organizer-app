require "test_helper"

class OpenrouterImageCleanerTest < ActiveSupport::TestCase
  test "generation prompt requests an exact high-contrast removable studio backdrop" do
    cleaner = OpenrouterImageCleaner.new(
      Rack::Test::UploadedFile.new(file_fixture("item-photo.png"), "image/png"),
      metadata_context: {
        category: "shirt",
        name: "Ivory Shirt"
      }
    )

    backdrop = cleaner.send(:selected_backdrop, file_fixture("item-photo.png").to_s)
    prompt = cleaner.send(:generation_prompt, backdrop)

    assert_includes prompt, "uniform solid chroma-style studio backdrop in exactly"
    assert_includes prompt, "flat matte color from edge to edge"
    assert_includes prompt, "all four image corners contain only the backdrop color"
    assert_includes prompt, "Do not substitute a different backdrop color"
    assert_includes prompt, "Do not add any cast shadow"
    assert_includes prompt, "no shadow silhouette"
    assert_includes prompt, "Category: shirt"
  end

  test "backdrop selector uses the uploaded image colors when metadata is sparse" do
    source = Tempfile.new([ "blue-garment-source", ".png" ])
    source.binmode

    MiniMagick::Tool.new(image_magick_command_name) do |command|
      command.size "48x48"
      command.xc "white"
      command.fill "#315fae"
      command.draw "rectangle 10,6 37,41"
      command << source.path
    end
    source.rewind

    backdrop = ImageCleanBackdropSelector.call(
      prompt_context: {},
      metadata_context: {},
      source_path: source.path
    )

    assert_equal "sunflower yellow", backdrop.fetch(:name)
  ensure
    source&.close!
  end

  test "backdrop selector avoids the green safety backdrop for green garments" do
    source = Tempfile.new([ "green-garment-source", ".png" ])
    source.binmode

    MiniMagick::Tool.new(image_magick_command_name) do |command|
      command.size "48x48"
      command.xc "white"
      command.fill "#4f8d45"
      command.draw "rectangle 10,6 37,41"
      command << source.path
    end
    source.rewind

    backdrop = ImageCleanBackdropSelector.call(
      prompt_context: {},
      metadata_context: {},
      source_path: source.path
    )

    assert_includes [ "raspberry red", "sunflower yellow" ], backdrop.fetch(:name)
  ensure
    source&.close!
  end

  private

  def image_magick_command_name
    MiniMagick.imagemagick7? ? "magick" : "convert"
  end
end
