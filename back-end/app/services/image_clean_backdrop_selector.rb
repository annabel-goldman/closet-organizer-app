require "mini_magick"

class ImageCleanBackdropSelector
  PALETTE = [
    { name: "raspberry red", hex: "#ff3f67", rgb: [ 255, 63, 103 ] },
    { name: "sunflower yellow", hex: "#ffd42a", rgb: [ 255, 212, 42 ] },
    { name: "chartreuse green", hex: "#b7f227", rgb: [ 183, 242, 39 ] }
  ].freeze

  NAMED_COLORS = {
    "black" => [ 18, 18, 18 ],
    "charcoal" => [ 54, 69, 79 ],
    "gray" => [ 128, 128, 128 ],
    "grey" => [ 128, 128, 128 ],
    "silver" => [ 192, 192, 192 ],
    "white" => [ 245, 245, 245 ],
    "ivory" => [ 255, 255, 240 ],
    "cream" => [ 255, 253, 208 ],
    "beige" => [ 245, 245, 220 ],
    "tan" => [ 210, 180, 140 ],
    "brown" => [ 139, 69, 19 ],
    "khaki" => [ 195, 176, 145 ],
    "navy" => [ 18, 44, 92 ],
    "blue" => [ 49, 99, 255 ],
    "denim" => [ 46, 94, 170 ],
    "teal" => [ 0, 128, 128 ],
    "cyan" => [ 0, 188, 212 ],
    "aqua" => [ 0, 188, 212 ],
    "turquoise" => [ 64, 224, 208 ],
    "green" => [ 52, 168, 83 ],
    "olive" => [ 107, 142, 35 ],
    "lime" => [ 191, 255, 0 ],
    "yellow" => [ 255, 214, 42 ],
    "gold" => [ 212, 175, 55 ],
    "orange" => [ 255, 140, 31 ],
    "coral" => [ 255, 127, 80 ],
    "red" => [ 220, 38, 38 ],
    "burgundy" => [ 128, 0, 32 ],
    "maroon" => [ 128, 0, 0 ],
    "pink" => [ 255, 182, 193 ],
    "blush" => [ 222, 154, 172 ],
    "rose" => [ 214, 89, 120 ],
    "purple" => [ 138, 43, 226 ],
    "violet" => [ 122, 56, 255 ],
    "lavender" => [ 181, 126, 220 ],
    "lilac" => [ 200, 162, 200 ]
  }.freeze

  def self.call(prompt_context: {}, metadata_context: {}, source_path: nil)
    new(prompt_context: prompt_context, metadata_context: metadata_context, source_path: source_path).call
  end

  def initialize(prompt_context: {}, metadata_context: {}, source_path: nil)
    @prompt_context = prompt_context
    @metadata_context = metadata_context
    @source_path = source_path
  end

  def call
    garment_rgb = inferred_garment_rgb
    return PALETTE.first unless garment_rgb

    PALETTE.max_by { |backdrop| backdrop_score(backdrop.fetch(:rgb), garment_rgb) }
  end

  private

  attr_reader :metadata_context, :prompt_context, :source_path

  def inferred_garment_rgb
    sampled_rgb = sampled_garment_rgb
    return sampled_rgb if sampled_rgb

    color_tokens.each do |token|
      rgb = NAMED_COLORS[token]
      return rgb if rgb
    end

    nil
  end

  def color_tokens
    @color_tokens ||= begin
      values = []
      values << prompt_context[:color]
      values << prompt_context[:name]
      values.concat(Array(prompt_context[:hard_constraints]))
      values.concat(Array(prompt_context[:soft_hints]))
      values.concat(Array(metadata_context[:tags]))
      values << metadata_context[:name]

      values
        .compact
        .flat_map { |value| value.to_s.downcase.scan(/[a-z]+/) }
        .uniq
    end
  end

  def sampled_garment_rgb
    return unless source_path.present? && File.exist?(source_path)

    image = MiniMagick::Image.open(source_path)
    pixels = image.get_pixels
    height = pixels.length
    return if height.zero?

    width = pixels.first.length
    return if width.zero?

    x_start = [ (width * 0.15).floor, 0 ].max
    x_end = [ (width * 0.85).ceil - 1, width - 1 ].min
    y_start = [ (height * 0.15).floor, 0 ].max
    y_end = [ (height * 0.85).ceil - 1, height - 1 ].min

    garment_pixels = []

    (y_start..y_end).step(sample_step_for(height)).each do |y|
      (x_start..x_end).step(sample_step_for(width)).each do |x|
        pixel = pixels[y][x]
        next unless garment_candidate_pixel?(pixel)

        garment_pixels << pixel.first(3)
      end
    end

    return if garment_pixels.empty?

    [
      average_channel(garment_pixels, 0),
      average_channel(garment_pixels, 1),
      average_channel(garment_pixels, 2)
    ]
  rescue StandardError
    nil
  end

  def garment_candidate_pixel?(pixel)
    red, green, blue, alpha = normalized_pixel(pixel)
    return false if alpha < 0.4

    max_channel = [ red, green, blue ].max
    min_channel = [ red, green, blue ].min
    saturation = max_channel.zero? ? 0.0 : (max_channel - min_channel).to_f / max_channel
    brightness = max_channel.to_f / 255.0

    saturation >= 0.18 || brightness <= 0.9
  end

  def normalized_pixel(pixel)
    values = pixel.first(4)
    values << 255 while values.length < 4
    values
  end

  def sample_step_for(length)
    [ (length / 24.0).floor, 1 ].max
  end

  def average_channel(pixels, index)
    (pixels.sum { |pixel| pixel[index] }.to_f / pixels.length).round
  end

  def backdrop_score(backdrop_rgb, garment_rgb)
    color_distance(backdrop_rgb, garment_rgb) + (luminance_distance(backdrop_rgb, garment_rgb) * 12_000)
  end

  def color_distance(first_rgb, second_rgb)
    first_rgb.zip(second_rgb).sum { |left, right| (left - right)**2 }
  end

  def luminance_distance(first_rgb, second_rgb)
    (relative_luminance(first_rgb) - relative_luminance(second_rgb)).abs
  end

  def relative_luminance(rgb)
    red, green, blue = rgb.map { |value| srgb_channel(value / 255.0) }
    (0.2126 * red) + (0.7152 * green) + (0.0722 * blue)
  end

  def srgb_channel(value)
    return value / 12.92 if value <= 0.03928

    ((value + 0.055) / 1.055)**2.4
  end
end
