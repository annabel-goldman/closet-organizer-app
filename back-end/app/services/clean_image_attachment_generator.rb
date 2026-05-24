class CleanImageAttachmentGenerator
  def self.call(record:, source_photo:, prompt_context:, temporary_files: [], reference_photos: [], metadata_context: {})
    new(
      record: record,
      source_photo: source_photo,
      prompt_context: prompt_context,
      temporary_files: temporary_files,
      reference_photos: reference_photos,
      metadata_context: metadata_context
    ).call
  end

  def initialize(record:, source_photo:, prompt_context:, temporary_files: [], reference_photos: [], metadata_context: {})
    @record = record
    @source_photo = source_photo
    @prompt_context = prompt_context
    @temporary_files = ManagedTempfiles.wrap(temporary_files)
    @reference_photos = Array(reference_photos).compact
    @metadata_context = metadata_context
  end

  def call
    record.update!(
      clean_image_status: :processing,
      clean_image_error_message: nil
    )

    generated = OpenrouterImageCleaner.call(
      source_photo,
      prompt_context: prompt_context,
      reference_photos: reference_photos,
      metadata_context: metadata_context
    )
    generated_tempfile = temporary_files.track(generated.fetch(:tempfile))
    filename_root = File.basename(generated.fetch(:filename).to_s, ".*").presence || "item-clean"
    processed = CleanImageBackgroundRemover.call(
      generated_tempfile,
      filename_root: filename_root,
      temporary_files: temporary_files
    )
    processed_tempfile = temporary_files.track(processed.fetch(:tempfile))

    record.cleaned_photo.attach(
      io: processed_tempfile,
      filename: processed.fetch(:filename),
      content_type: processed.fetch(:content_type)
    )
    record.update!(
      clean_image_status: :succeeded,
      clean_image_error_message: nil,
      clean_image_provider: generated.fetch(:provider),
      clean_image_model: generated.fetch(:model),
      clean_image_generated_at: Time.current
    )
  rescue StandardError => error
    record.update(
      clean_image_status: :failed,
      clean_image_error_message: error.message
    )
    raise
  ensure
    cleanup_temporary_files
  end

  private

  attr_reader :metadata_context, :prompt_context, :record, :reference_photos, :source_photo, :temporary_files

  def cleanup_temporary_files
    temporary_files.close_all
  end
end
