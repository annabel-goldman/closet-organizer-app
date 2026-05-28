require "mini_magick"
require "tempfile"

class CleanImageBackgroundRemover
  DEFAULT_BACKGROUND_FUZZ = "12%".freeze
  DEFAULT_SHARPEN_AMOUNT = "0x0.8".freeze

  def self.call(image_source, filename_root:, temporary_files: [])
    new(image_source, filename_root: filename_root, temporary_files: temporary_files).call
  end

  def initialize(image_source, filename_root:, temporary_files: [])
    @image_source = image_source
    @filename_root = filename_root
    @temporary_files = ManagedTempfiles.wrap(temporary_files)
  end

  def call
    source_file = prepared_source_file
    output_file = temporary_files.track(Tempfile.new([ "#{filename_root}-transparent", ".png" ]))
    output_file.binmode
    sampled_background_color = dominant_corner_background_color(source_file.path)

    MiniMagick::Tool.new(image_magick_command_name) do |command|
      command << source_file.path
      # Remove only edge-connected background pixels sampled from the corners
      # so light details inside the garment remain intact.
      command.alpha "set"
      command.bordercolor sampled_background_color
      command.border "1x1"
      command.fuzz configured_background_fuzz
      command.fill "none"
      command.draw "color 0,0 floodfill"
      command.shave "1x1"
      command.sharpen configured_sharpen_amount
      command << output_file.path
    end
    output_file.rewind

    {
      tempfile: output_file,
      filename: "#{filename_root}-transparent.png",
      content_type: "image/png"
    }
  end

  private

  attr_reader :filename_root, :image_source, :temporary_files

  def configured_background_fuzz
    ENV.fetch("AI_CLEAN_BACKGROUND_FUZZ", DEFAULT_BACKGROUND_FUZZ)
  end

  def configured_sharpen_amount
    ENV.fetch("AI_CLEAN_SHARPEN", DEFAULT_SHARPEN_AMOUNT)
  end

  def image_magick_command_name
    MiniMagick.imagemagick7? ? "magick" : "convert"
  end

  def dominant_corner_background_color(image_path)
    image = MiniMagick::Image.open(image_path)
    width = image.width
    height = image.height
    corner_points = [
      [ 0, 0 ],
      [ [ width - 1, 0 ].max, 0 ],
      [ 0, [ height - 1, 0 ].max ],
      [ [ width - 1, 0 ].max, [ height - 1, 0 ].max ]
    ]
    sampled_colors = corner_points.map { |x, y| image["%[pixel:p{#{x},#{y}}]"] }

    sampled_colors
      .group_by(&:itself)
      .max_by { |color, occurrences| [ occurrences.length, -sampled_colors.index(color) ] }
      &.first || "white"
  rescue StandardError
    "white"
  end

  def prepared_source_file
    return image_source if image_source.respond_to?(:path)

    tempfile = temporary_files.track(Tempfile.new([ filename_root, ".png" ]))
    tempfile.binmode
    image_source.rewind if image_source.respond_to?(:rewind)
    IO.copy_stream(image_source, tempfile)
    tempfile.rewind
    tempfile
  end
end
