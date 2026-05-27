require "tempfile"
class TransparentPngVariantGenerator

  def self.call(image_source, filename_root:, temporary_files: [])
    new(image_source, filename_root: filename_root, temporary_files: temporary_files).call
  end

  def initialize(image_source, filename_root:, temporary_files: [])
    @image_source = image_source
    @filename_root = filename_root
    @temporary_files = ManagedTempfiles.wrap(temporary_files)
  end

  def call
    with_source_file do |source_file|
      transparent_result = CleanImageBackgroundRemover.call(
        source_file,
        filename_root: filename_root,
        temporary_files: temporary_files
      )
      transparent_file = temporary_files.track(transparent_result.fetch(:tempfile))

      {
        tempfile: transparent_file,
        filename: transparent_result.fetch(:filename),
        content_type: transparent_result.fetch(:content_type),
        image_variant: "transparent",
        cutout_fallback: false
      }
    end
  end

  private

  attr_reader :filename_root, :image_source, :temporary_files

  def with_source_file
    if image_source.respond_to?(:blob)
      image_source.blob.open do |file|
        return yield file
      end
    end

    yield prepared_source_file
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
