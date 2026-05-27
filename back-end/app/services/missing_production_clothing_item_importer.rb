require "json"
require "set"
require "stringio"

class MissingProductionClothingItemImporter
  Error = Class.new(StandardError)
  MissingConfigurationError = Class.new(Error)
  SourceAccountNotFoundError = Class.new(Error)
  TargetUserNotFoundError = Class.new(Error)

  class SourceRecord < ActiveRecord::Base
    self.abstract_class = true
  end

  class SourceUser < SourceRecord
    self.table_name = "users"
  end

  class SourceClothingItem < SourceRecord
    self.table_name = "clothing_items"
  end

  class SourceActiveStorageAttachment < SourceRecord
    self.table_name = "active_storage_attachments"
  end

  class SourceActiveStorageBlob < SourceRecord
    self.table_name = "active_storage_blobs"
  end

  SourceModels = Struct.new(
    :base,
    :users,
    :clothing_items,
    :active_storage_attachments,
    :active_storage_blobs,
    keyword_init: true
  )

  def initialize(source_email:, target_email: nil, source_database_url: nil, source_connection_config: nil,
                 storage_service_name: nil)
    @source_email = source_email.to_s.strip
    @target_email = target_email.to_s.strip.presence || @source_email
    @source_database_url = source_database_url.to_s.strip.presence
    @source_connection_config = source_connection_config&.deep_symbolize_keys
    @storage_service_name = storage_service_name.to_s.strip.presence || default_storage_service_name
  end

  def call
    validate_configuration!
    source = build_source_models

    connect_source_models!(source)

    source_user = find_source_user(source)
    raise SourceAccountNotFoundError, "No production user found for #{@source_email}" unless source_user

    target_user = find_target_user
    source_items = source.clothing_items.where(user_id: source_user.id).order(:id).to_a
    source_photo_blobs = source_attachment_blobs(
      source,
      record_type: "ClothingItem",
      record_ids: source_items.map(&:id)
    )
    existing_checksums = local_photo_checksums_for(target_user)

    imported_item_ids = []
    skipped_existing = 0
    skipped_without_source_photo = 0

    source_items.each do |source_item|
      source_photo_blob = source_photo_blobs[[ source_item.id, "photo" ]]
      unless source_photo_blob
        skipped_without_source_photo += 1
        next
      end

      if existing_checksums.include?(source_photo_blob.checksum)
        skipped_existing += 1
        next
      end

      target_item = target_user.clothing_items.new(
        name: source_item.name,
        category: source_item.category,
        brand: source_item.brand,
        size: source_item.size,
        date: source_item.date,
        tags: normalize_json_value(source_item.tags),
        clean_image_status: :idle,
        clean_image_error_message: nil,
        clean_image_provider: nil,
        clean_image_model: nil,
        clean_image_generated_at: nil
      )
      target_item.save!(validate: false)
      clone_attachment!(source_photo_blob, target_item.photo)
      preserve_timestamps!(target_item, source_item)

      existing_checksums << target_item.photo.blob.checksum if target_item.photo.attached?
      imported_item_ids << target_item.id
    end

    {
      source_email: @source_email,
      target_email: target_user.email,
      user_id: target_user.id,
      total_source_items: source_items.size,
      imported: imported_item_ids.size,
      imported_item_ids: imported_item_ids,
      skipped_existing: skipped_existing,
      skipped_without_source_photo: skipped_without_source_photo,
      storage_service: @storage_service_name
    }
  ensure
    disconnect_source_models!(source) if source
  end

  private

  def validate_configuration!
    unless Rails.env.development? || Rails.env.test?
      raise Error, "Production item import is only available in development and test."
    end

    raise MissingConfigurationError, "PRODUCTION_ACCOUNT_EMAIL is required." if @source_email.blank?

    if @source_connection_config.blank? && @source_database_url.blank?
      raise MissingConfigurationError, "PRODUCTION_DATABASE_URL is required."
    end

    ActiveStorage::Blob.services.fetch(@storage_service_name)
  rescue KeyError
    raise MissingConfigurationError, "Unknown Active Storage service #{@storage_service_name.inspect}."
  end

  def resolved_source_connection_config
    @source_connection_config.presence || { url: @source_database_url }
  end

  def default_storage_service_name
    Rails.application.config.active_storage.service.to_s
  end

  def build_source_models
    SourceModels.new(
      base: SourceRecord,
      users: SourceUser,
      clothing_items: SourceClothingItem,
      active_storage_attachments: SourceActiveStorageAttachment,
      active_storage_blobs: SourceActiveStorageBlob
    )
  end

  def connect_source_models!(source)
    connection_config = resolved_source_connection_config
    source.to_h.each_value do |klass|
      klass.establish_connection(connection_config)
      klass.reset_column_information unless klass.abstract_class?
    end
  end

  def disconnect_source_models!(source)
    source.to_h.each_value(&:remove_connection)
  end

  def find_source_user(source)
    source.users.where("lower(email) = ?", @source_email.downcase).first
  end

  def find_target_user
    User.where("lower(email) = ?", @target_email.downcase).first ||
      raise(TargetUserNotFoundError, "No local user found for #{@target_email}.")
  end

  def local_photo_checksums_for(target_user)
    target_user.clothing_items
      .with_attached_photo
      .each_with_object(Set.new) do |item, checksums|
        checksums << item.photo.blob.checksum if item.photo.attached?
      end
  end

  def source_attachment_blobs(source, record_type:, record_ids:)
    return {} if record_ids.blank?

    attachments = source.active_storage_attachments.where(record_type: record_type, record_id: record_ids).to_a
    return {} if attachments.empty?

    blobs_by_id = source.active_storage_blobs.where(id: attachments.map(&:blob_id).uniq).index_by(&:id)

    attachments.each_with_object({}) do |attachment, memo|
      memo[[ attachment.record_id, attachment.name ]] = blobs_by_id[attachment.blob_id]
    end
  end

  def clone_attachment!(source_blob, target_attachment)
    bytes = source_storage_service(source_blob).download(source_blob.key)
    uploaded_blob = ActiveStorage::Blob.create_and_upload!(
      io: StringIO.new(bytes.b),
      filename: source_blob.filename,
      content_type: source_blob.content_type,
      metadata: normalized_blob_metadata(source_blob.metadata),
      service_name: @storage_service_name
    )
    target_attachment.attach(uploaded_blob)
  end

  def source_storage_service(source_blob)
    ActiveStorage::Blob.services.fetch(source_blob.service_name)
  rescue KeyError
    raise MissingConfigurationError, "Missing storage configuration for source service #{source_blob.service_name.inspect}."
  end

  def normalized_blob_metadata(value)
    parsed = normalize_json_value(value)
    parsed.is_a?(Hash) ? parsed : {}
  end

  def normalize_json_value(value)
    return if value.nil?
    return value if value.is_a?(Hash) || value.is_a?(Array)

    JSON.parse(value)
  rescue JSON::ParserError, TypeError
    value
  end

  def preserve_timestamps!(target_record, source_record)
    target_record.update_columns(
      created_at: source_record.created_at,
      updated_at: source_record.updated_at
    )
  end
end
