class CleanImageAttachmentGenerator
  def self.call(record:, source_photo:, prompt_context:, temporary_files: [])
    new(
      record: record,
      source_photo: source_photo,
      prompt_context: prompt_context,
      temporary_files: temporary_files
    ).call
  end

  def initialize(record:, source_photo:, prompt_context:, temporary_files: [])
    @record = record
    @source_photo = source_photo
    @prompt_context = prompt_context
    @temporary_files = ManagedTempfiles.wrap(temporary_files)
  end

  def call
    record.update!(
      clean_image_status: :processing,
      clean_image_error_message: nil
    )

    generated = OpenrouterImageCleaner.call(source_photo, prompt_context: prompt_context)
    generated_tempfile = temporary_files.track(generated.fetch(:tempfile))

    record.cleaned_photo.attach(
      io: generated_tempfile,
      filename: generated.fetch(:filename),
      content_type: generated.fetch(:content_type)
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

  attr_reader :prompt_context, :record, :source_photo, :temporary_files

  def cleanup_temporary_files
    temporary_files.close_all
  end
end
