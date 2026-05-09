class PreparedImageSource
  def self.from_attachment(attachment)
    new(
      io: StringIO.new(attachment.download),
      filename: attachment.blob.filename.to_s,
      content_type: attachment.blob.content_type
    )
  end

  def self.from_crop_result(cropped_photo, temporary_files:)
    new(
      io: ManagedTempfiles.wrap(temporary_files).track(cropped_photo.fetch(:tempfile)),
      filename: cropped_photo.fetch(:filename),
      content_type: cropped_photo.fetch(:content_type)
    )
  end

  def initialize(io:, filename:, content_type:)
    @io = io
    @filename = filename
    @content_type = content_type
  end

  def attach_to(attachment)
    attachment.attach(io: io, filename: filename, content_type: content_type)
  end

  def tempfile
    io if io.respond_to?(:path)
  end

  def original_filename
    filename
  end

  attr_reader :content_type

  private

  attr_reader :filename, :io
end
