class WardrobeColorLexicon
  RGB = {
    "black" => [ 20, 20, 20 ], "white" => [ 245, 245, 242 ], "cream" => [ 244, 235, 210 ],
    "ivory" => [ 238, 232, 205 ], "beige" => [ 210, 190, 160 ], "tan" => [ 194, 154, 108 ],
    "camel" => [ 193, 154, 107 ], "brown" => [ 105, 68, 45 ], "chocolate" => [ 82, 52, 38 ],
    "rust" => [ 166, 72, 42 ], "orange" => [ 230, 120, 35 ], "yellow" => [ 235, 199, 65 ],
    "gold" => [ 190, 148, 55 ], "red" => [ 190, 40, 45 ], "burgundy" => [ 105, 28, 48 ],
    "maroon" => [ 105, 30, 42 ], "pink" => [ 225, 135, 160 ], "blush" => [ 225, 180, 175 ],
    "purple" => [ 115, 70, 145 ], "lavender" => [ 180, 160, 210 ], "blue" => [ 55, 105, 170 ],
    "navy" => [ 30, 45, 80 ], "teal" => [ 40, 120, 125 ], "green" => [ 55, 120, 70 ],
    "olive" => [ 105, 110, 55 ], "sage" => [ 145, 160, 125 ], "gray" => [ 135, 135, 135 ],
    "grey" => [ 135, 135, 135 ], "silver" => [ 185, 188, 190 ], "denim" => [ 70, 105, 145 ]
  }.freeze

  def self.lab_for(name)
    rgb = RGB[name.to_s.downcase]
    ColorScience.rgb_to_lab(rgb) if rgb
  end

  def self.known_names
    RGB.keys
  end
end
