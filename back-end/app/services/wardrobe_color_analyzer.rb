require "image_processing/mini_magick"
require "mini_magick"

class WardrobeColorAnalyzer
  SAMPLE_SIZE = "80x80".freeze
  MAX_COLORS = 5

  def self.call(attachment)
    new(attachment).call
  end

  def initialize(attachment)
    @attachment = attachment
  end

  def call
    attachment.blob.open do |source|
      sampled = ImageProcessing::MiniMagick
        .source(source.path)
        .resize_to_limit(80, 80)
        .convert("png")
        .call

      begin
        image = MiniMagick::Image.open(sampled.path)
        pixels = image.get_pixels.flatten(1)
        summarize(pixels)
      ensure
        sampled.close!
      end
    end
  end

  private

  attr_reader :attachment

  def summarize(pixels)
    buckets = Hash.new(0)
    usable_count = 0

    pixels.each do |pixel|
      red, green, blue, alpha = Array(pixel).map(&:to_i)
      next if alpha && alpha < 40
      next if red > 246 && green > 246 && blue > 246

      key = [ red, green, blue ].map { |channel| ((channel / 32.0).round * 32).clamp(0, 255) }
      buckets[key] += 1
      usable_count += 1
    end

    return [] if usable_count.zero?

    buckets
      .sort_by { |_rgb, count| -count }
      .first(MAX_COLORS)
      .map do |rgb, count|
        {
          "hex" => format("#%02X%02X%02X", *rgb),
          "rgb" => rgb,
          "proportion" => (count.to_f / usable_count).round(4),
          "lab" => ColorScience.rgb_to_lab(rgb).map { |value| value.round(4) }
        }
      end
  end
end
