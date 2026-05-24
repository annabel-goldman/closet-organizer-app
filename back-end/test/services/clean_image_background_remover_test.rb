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

  private

  def image_magick_command_name
    MiniMagick.imagemagick7? ? "magick" : "convert"
  end
end
