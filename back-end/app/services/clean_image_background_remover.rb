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
    output_file = temporary_files.track(Tempfile.new([ "#{filename_root}-no-background", ".png" ]))
    output_file.binmode

    MiniMagick.convert do |command|
      command << source_file.path
      # Flood-filling from the added corner border removes only edge-connected
      # near-white pixels, which preserves white details that belong to the item.
      command.alpha "set"
      command.bordercolor "white"
      command.border "1x1"
      command.fuzz configured_background_fuzz
      command.fill "none"
      command.draw "alpha 0,0 floodfill"
      command.shave "1x1"
      # A light sharpen pass restores some edge definition after the AI clean
      # image generation and transparent-background conversion steps.
      command.sharpen configured_sharpen_amount
      command << output_file.path
    end
    output_file.rewind

    {
      tempfile: output_file,
      filename: "#{filename_root}-clean.png",
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
