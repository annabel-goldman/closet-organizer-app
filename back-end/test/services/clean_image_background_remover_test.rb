require "test_helper"
require "mini_magick"
require "tempfile"

class CleanImageBackgroundRemoverTest < ActiveSupport::TestCase
  test "removes only the edge-connected white background" do
    source = Tempfile.new([ "background-removal-source", ".png" ])
    source.binmode

    MiniMagick.convert do |convert|
      convert.size "40x40"
      convert.xc "white"
      convert.fill "black"
      convert.draw "rectangle 8,8 31,31"
      convert.fill "white"
      convert.draw "rectangle 16,16 23,23"
      convert << source.path
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
end
