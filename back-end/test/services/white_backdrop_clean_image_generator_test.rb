require "test_helper"
require "mini_magick"
require "tempfile"

class WhiteBackdropCleanImageGeneratorTest < ActiveSupport::TestCase
  test "recolors the dominant edge-connected backdrop to white without transparency" do
    source = Tempfile.new([ "white-backdrop-source", ".png" ])
    source.binmode

    MiniMagick::Tool.new(image_magick_command_name) do |command|
      command.size "40x40"
      command.xc "#2d5bff"
      command.fill "black"
      command.draw "rectangle 8,8 31,31"
      command.fill "#2d5bff"
      command.draw "rectangle 16,16 23,23"
      command << source.path
    end
    source.rewind

    result = WhiteBackdropCleanImageGenerator.call(source, filename_root: "synthetic-item")
    output = MiniMagick::Image.open(result.fetch(:tempfile).path)

    assert_equal "image/png", result.fetch(:content_type)
    assert_equal "synthetic-item-clean.png", result.fetch(:filename)
    assert_equal "srgb(255,255,255)", output["%[pixel:p{0,0}]"]
    assert_equal "srgb(0,0,0)", output["%[pixel:p{12,12}]"]
    assert_equal "srgb(45,91,255)", output["%[pixel:p{20,20}]"]
  ensure
    source&.close!
    result&.dig(:tempfile)&.close!
  end

  private

  def image_magick_command_name
    MiniMagick.imagemagick7? ? "magick" : "convert"
  end
end
