class TransparentPngAttachmentGenerator
  def self.call(record:, source_photo:, temporary_files: [])
    new(record: record, source_photo: source_photo, temporary_files: temporary_files).call
  end

  def initialize(record:, source_photo:, temporary_files: [])
    @record = record
    @source_photo = source_photo
    @temporary_files = ManagedTempfiles.wrap(temporary_files)
  end

  def call
    record.update!(
      clean_image_status: :processing,
      clean_image_error_message: nil,
      clean_image_cutout_fallback: false
    )

    filename_root = source_filename_root
    variant = TransparentPngVariantGenerator.call(
      source_photo,
      filename_root: filename_root,
      temporary_files: temporary_files
    )
    generated_tempfile = temporary_files.track(variant.fetch(:tempfile))

    record.cleaned_photo.attach(
      io: generated_tempfile,
      filename: variant.fetch(:filename),
      content_type: variant.fetch(:content_type)
    )
    record.update!(
      clean_image_status: :succeeded,
      clean_image_error_message: nil,
      clean_image_generated_at: Time.current,
      clean_image_variant: variant.fetch(:image_variant),
      clean_image_cutout_fallback: variant.fetch(:cutout_fallback)
    )
  rescue StandardError => error
    record.update(
      clean_image_status: :failed,
      clean_image_error_message: error.message
    )
    raise
  ensure
    temporary_files.close_all
  end

  private

  attr_reader :record, :source_photo, :temporary_files

  def source_filename_root
    if source_photo.respond_to?(:blob)
      return File.basename(source_photo.blob.filename.to_s, ".*").presence || "item-clean"
    end

    if source_photo.respond_to?(:original_filename)
      return File.basename(source_photo.original_filename.to_s, ".*").presence || "item-clean"
    end

    File.basename(source_photo.path.to_s, ".*").presence || "item-clean"
  end
end
