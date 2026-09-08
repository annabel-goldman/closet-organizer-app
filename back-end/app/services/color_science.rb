module ColorScience
  module_function

  def rgb_to_lab(rgb)
    red, green, blue = rgb.map { |channel| channel.to_f / 255 }
    red, green, blue = [ red, green, blue ].map do |channel|
      channel > 0.04045 ? ((channel + 0.055) / 1.055)**2.4 : channel / 12.92
    end

    x = (red * 0.4124 + green * 0.3576 + blue * 0.1805) / 0.95047
    y = red * 0.2126 + green * 0.7152 + blue * 0.0722
    z = (red * 0.0193 + green * 0.1192 + blue * 0.9505) / 1.08883
    x, y, z = [ x, y, z ].map do |value|
      value > 0.008856 ? value**(1.0 / 3) : (7.787 * value) + (16.0 / 116)
    end

    [ (116 * y) - 16, 500 * (x - y), 200 * (y - z) ]
  end

  def delta_e(left, right)
    Math.sqrt(left.zip(right).sum { |a, b| (a.to_f - b.to_f)**2 })
  end
end
