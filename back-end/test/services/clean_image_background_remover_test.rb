require "test_helper"
require "mini_magick"
require "tempfile"

class CleanImageBackgroundRemoverTest < ActiveSupport::TestCase
  test "removes only the edge-connected white background" do
    source = Tempfile.new([ "background-removal-source", ".png" ])
    source.binmode

    MiniMagick::Tool.new(image_magick_command_name) do |command|
      command.size "40x40"
      command.xc "white"
      command.fill "black"
      command.draw "rectangle 8,8 31,31"
      command.fill "white"
      command.draw "rectangle 16,16 23,23"
      command << source.path
    end
    source.rewind

    result = CleanImageBackgroundRemover.call(source, filename_root: "synthetic-item")
    output = MiniMagick::Image.open(result.fetch(:tempfile).path)

    assert_equal "image/png", result.fetch(:content_type)
    assert_equal "synthetic-item-clean.png", result.fetch(:filename)
    assert_equal "graya(0,0)", output["%[pixel:p{0,0}]"]
    assert_equal "graya(0,1)", output["%[pixel:p{12,12}]"]
    assert_equal "graya(255,1)", output["%[pixel:p{20,20}]"]
  ensure
    source&.close!
    result&.dig(:tempfile)&.close!
  end

  test "removes an edge-connected colored studio backdrop" do
    source = Tempfile.new([ "background-removal-colored-source", ".png" ])
    source.binmode

    MiniMagick::Tool.new(image_magick_command_name) do |command|
      command.size "40x40"
      command.xc "#c7f3f4"
      command.fill "black"
      command.draw "rectangle 8,8 31,31"
      command.fill "#c7f3f4"
      command.draw "rectangle 16,16 23,23"
      command << source.path
    end
    source.rewind

    result = CleanImageBackgroundRemover.call(source, filename_root: "synthetic-colored-item")
    output = MiniMagick::Image.open(result.fetch(:tempfile).path)

    assert_equal "image/png", result.fetch(:content_type)
    assert_equal "synthetic-colored-item-clean.png", result.fetch(:filename)
    assert_equal "srgba(0,0,0,0)", output["%[pixel:p{0,0}]"]
    assert_equal "srgba(0,0,0,1)", output["%[pixel:p{12,12}]"]
    assert_equal "srgba(199,243,244,1)", output["%[pixel:p{20,20}]"]
  ensure
    source&.close!
    result&.dig(:tempfile)&.close!
  end

  test "uses the dominant corner backdrop color instead of trusting only one corner" do
    source = Tempfile.new([ "background-removal-dominant-corner-source", ".png" ])
    source.binmode

    MiniMagick::Tool.new(image_magick_command_name) do |command|
      command.size "40x40"
      command.xc "#c7f3f4"
      command.fill "#ffd4e5"
      command.draw "point 0,0"
      command.fill "black"
      command.draw "rectangle 8,8 31,31"
      command << source.path
    end
    source.rewind

    remover = CleanImageBackgroundRemover.new(source, filename_root: "synthetic-dominant-corner-item")

    assert_equal "srgb(199,243,244)", remover.send(:dominant_corner_background_color, source.path)

    result = remover.call
    output = MiniMagick::Image.open(result.fetch(:tempfile).path)

    assert_equal "image/png", result.fetch(:content_type)
    assert_equal "synthetic-dominant-corner-item-clean.png", result.fetch(:filename)
    assert_includes [ "srgba(0,0,0,0)", "graya(0,0)" ], output["%[pixel:p{39,39}]"]
    assert_equal "graya(0,1)", output["%[pixel:p{12,12}]"]
  ensure
    source&.close!
    result&.dig(:tempfile)&.close!
  end

  private

  def image_magick_command_name
    MiniMagick.imagemagick7? ? "magick" : "convert"
  end
end
