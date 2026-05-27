require "digest"
require "json"
require "stringio"

class AccountAttachmentCopier
  Error = Class.new(StandardError)
  MissingAttachmentPayloadError = Class.new(Error)

  def initialize(storage_service_name: nil)
    @storage_service_name = storage_service_name.to_s.strip.presence || default_storage_service_name
  end

  def export_attachment(record_type:, record_source_id:, attachment_role:, attachment:, attachment_payloads:)
    return unless attachment&.attached?

    payload = attachment.download.to_s.b
    sha256 = Digest::SHA256.hexdigest(payload)
    archive_path = "attachments/#{sha256}"
    attachment_payloads[archive_path] ||= payload

    {
      "record_type" => record_type,
      "record_source_id" => record_source_id,
      "attachment_role" => attachment_role,
      "filename" => attachment.blob.filename.to_s,
      "content_type" => attachment.blob.content_type,
      "byte_size" => attachment.blob.byte_size,
      "checksum" => attachment.blob.checksum,
      "sha256" => sha256,
      "archive_path" => archive_path,
      "metadata" => normalized_blob_metadata(attachment.blob.metadata)
    }
  end

  def attach_snapshot_attachment!(attachment_entry:, files:, target_attachment:)
    archive_path = attachment_entry.fetch("archive_path")
    payload = files[archive_path]
    raise MissingAttachmentPayloadError, "Snapshot archive is missing #{archive_path}." unless payload

    uploaded_blob = ActiveStorage::Blob.create_and_upload!(
      io: StringIO.new(payload.b),
      filename: attachment_entry.fetch("filename"),
      content_type: attachment_entry["content_type"],
      metadata: normalized_blob_metadata(attachment_entry["metadata"]),
      service_name: @storage_service_name
    )

    target_attachment.attach(uploaded_blob)
  end

  def storage_service_name
    @storage_service_name
  end

  private

  def default_storage_service_name
    Rails.application.config.active_storage.service.to_s
  end

  def normalized_blob_metadata(value)
    parsed =
      case value
      when Hash
        value
      when String
        JSON.parse(value)
      else
        value
      end

    parsed.is_a?(Hash) ? JSON.parse(JSON.generate(parsed)) : {}
  rescue JSON::ParserError, TypeError
    {}
  end
end
