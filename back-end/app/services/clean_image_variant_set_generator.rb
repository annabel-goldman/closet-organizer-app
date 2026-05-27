class CleanImageVariantSetGenerator
  def self.call(source_photo, prompt_context: {}, reference_photos: [], metadata_context: {}, temporary_files: [])
    new(
      source_photo,
      prompt_context: prompt_context,
      reference_photos: reference_photos,
      metadata_context: metadata_context,
      temporary_files: temporary_files
    ).call
  end

  def initialize(source_photo, prompt_context: {}, reference_photos: [], metadata_context: {}, temporary_files: [])
    @source_photo = source_photo
    @prompt_context = prompt_context
    @reference_photos = reference_photos
    @metadata_context = metadata_context
    @temporary_files = ManagedTempfiles.wrap(temporary_files)
  end

  def call
    working = OpenrouterImageCleaner.call(
      source_photo,
      prompt_context: prompt_context,
      reference_photos: reference_photos,
      metadata_context: metadata_context
    )
    working_tempfile = temporary_files.track(working.fetch(:tempfile))
    working_tempfile.rewind
    filename_root = working.fetch(:filename_root)
    display = WhiteBackdropCleanImageGenerator.call(
      working_tempfile,
      filename_root: filename_root,
      temporary_files: temporary_files
    )

    {
      display: display,
      provider: working.fetch(:provider),
      model: working.fetch(:model),
      raw_response: working.fetch(:raw_response),
      working: {
        tempfile: working_tempfile,
        filename: working.fetch(:filename),
        content_type: working.fetch(:content_type)
      }
    }
  end

  private

  attr_reader :metadata_context, :prompt_context, :reference_photos, :source_photo, :temporary_files
end
