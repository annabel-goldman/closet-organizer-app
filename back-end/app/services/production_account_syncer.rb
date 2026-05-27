require "json"
require "stringio"

class ProductionAccountSyncer
  Error = Class.new(StandardError)
  MissingConfigurationError = Class.new(Error)
  SourceAccountNotFoundError = Class.new(Error)

  class SourceRecord < ActiveRecord::Base
    self.abstract_class = true
  end

  class SourceUser < SourceRecord
    self.table_name = "users"
  end

  class SourceClothingItem < SourceRecord
    self.table_name = "clothing_items"
  end

  class SourceOutfit < SourceRecord
    self.table_name = "outfits"
  end

  class SourceOutfitItem < SourceRecord
    self.table_name = "outfit_items"
  end

  class SourceOutfitUpload < SourceRecord
    self.table_name = "outfit_uploads"
  end

  class SourceOutfitDetection < SourceRecord
    self.table_name = "outfit_detections"
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
    :outfits,
    :outfit_items,
    :outfit_uploads,
    :outfit_detections,
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

    summary = nil

    ActiveRecord::Base.transaction do
      target_user = find_or_initialize_target_user
      sync_target_user!(target_user, source_user)
      remove_target_account_data!(target_user)

      upload_map = import_outfit_uploads(source, source_user, target_user)
      detection_map = import_outfit_detections(source, upload_map)
      item_map = import_clothing_items(source, source_user, target_user, upload_map, detection_map)
      outfit_map = import_outfits(source, source_user, target_user)
      import_outfit_items(source, outfit_map, item_map)

      preserve_timestamps!(target_user, source_user)

      summary = {
        source_email: @source_email,
        target_email: target_user.email,
        user_id: target_user.id,
        clothing_items: item_map.size,
        outfits: outfit_map.size,
        outfit_uploads: upload_map.size,
        outfit_detections: detection_map.size,
        storage_service: @storage_service_name
      }
    end

    summary
  ensure
    disconnect_source_models!(source) if source
  end

  private

  def validate_configuration!
    unless Rails.env.development? || Rails.env.test?
      raise Error, "Production account sync is only available in development and test."
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
      outfits: SourceOutfit,
      outfit_items: SourceOutfitItem,
      outfit_uploads: SourceOutfitUpload,
      outfit_detections: SourceOutfitDetection,
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

  def find_or_initialize_target_user
    User.where("lower(email) = ?", @target_email.downcase).first || User.new(email: @target_email)
  end

  def sync_target_user!(target_user, source_user)
    target_user.password = SecureRandom.hex(24) if target_user.new_record?
    target_user.assign_attributes(
      email: source_user.email.presence || @target_email,
      username: resolved_target_username(source_user.username, except_id: target_user.id),
      preferred_style: source_user.preferred_style,
      provider: source_user.provider,
      uid: source_user.uid,
      avatar_url: source_user.avatar_url,
      admin: source_user.admin
    )
    target_user.save!
  end

  def resolved_target_username(preferred_username, except_id:)
    candidate = preferred_username.to_s.strip.presence || @target_email.split("@").first
    return candidate unless username_taken_locally?(candidate, except_id: except_id)

    suffix = 2
    loop do
      numbered_candidate = "#{candidate} #{suffix}"
      return numbered_candidate unless username_taken_locally?(numbered_candidate, except_id: except_id)

      suffix += 1
    end
  end

  def username_taken_locally?(username, except_id:)
    scope = User.where(username: username)
    scope = scope.where.not(id: except_id) if except_id.present?
    scope.exists?
  end

  def remove_target_account_data!(target_user)
    clothing_item_ids = target_user.clothing_items.pluck(:id)
    outfit_ids = target_user.outfits.pluck(:id)
    outfit_upload_ids = target_user.outfit_uploads.pluck(:id)
    outfit_detection_ids = OutfitDetection.where(outfit_upload_id: outfit_upload_ids).pluck(:id)

    safely_delete_attachment_rows("ClothingItem", clothing_item_ids)
    safely_delete_attachment_rows("OutfitUpload", outfit_upload_ids)
    safely_delete_attachment_rows("OutfitDetection", outfit_detection_ids)

    OutfitItem.where(outfit_id: outfit_ids).or(OutfitItem.where(clothing_item_id: clothing_item_ids)).delete_all
    Outfit.delete(outfit_ids) if outfit_ids.any?
    ClothingItem.delete(clothing_item_ids) if clothing_item_ids.any?
    OutfitDetection.where(id: outfit_detection_ids).delete_all
    OutfitUpload.delete(outfit_upload_ids) if outfit_upload_ids.any?
  end

  # Use database deletes instead of attachment purge so a sync never removes
  # files from a production-backed storage service.
  def safely_delete_attachment_rows(record_type, record_ids)
    return if record_ids.blank?

    attachments = ActiveStorage::Attachment.where(record_type: record_type, record_id: record_ids)
    attachment_rows = attachments.select(:id, :blob_id).to_a
    return if attachment_rows.empty?

    blob_ids = attachment_rows.map(&:blob_id).uniq
    attachment_ids = attachment_rows.map(&:id)
    remaining_blob_ids = ActiveStorage::Attachment.where(blob_id: blob_ids).where.not(id: attachment_ids).distinct.pluck(:blob_id)
    orphan_blob_ids = blob_ids - remaining_blob_ids

    ActiveStorage::VariantRecord.where(blob_id: orphan_blob_ids).delete_all if orphan_blob_ids.any?
    attachments.delete_all
    ActiveStorage::Blob.where(id: orphan_blob_ids).delete_all if orphan_blob_ids.any?
  end

  def import_outfit_uploads(source, source_user, target_user)
    source_uploads = source.outfit_uploads.where(user_id: source_user.id).order(:id).to_a
    source_photo_blobs = source_attachment_blobs(
      source,
      record_type: "OutfitUpload",
      record_ids: source_uploads.map(&:id)
    )

    source_uploads.each_with_object({}) do |source_upload, memo|
      target_upload = target_user.outfit_uploads.new(
        status: source_upload.status,
        provider: source_upload.provider,
        vision_model: source_upload.vision_model,
        error_message: source_upload.error_message,
        detected_at: source_upload.detected_at,
        raw_response: normalize_json_value(source_upload.raw_response)
      )
      target_upload.save!(validate: false)
      clone_attachment!(source_photo_blobs[[ source_upload.id, "source_photo" ]], target_upload.source_photo)
      preserve_timestamps!(target_upload, source_upload)
      memo[source_upload.id] = target_upload
    end
  end

  def import_outfit_detections(source, upload_map)
    source_upload_ids = upload_map.keys
    return {} if source_upload_ids.empty?

    source_detections = source.outfit_detections.where(outfit_upload_id: source_upload_ids).order(:outfit_upload_id, :position, :id).to_a
    cleaned_photo_blobs = source_attachment_blobs(
      source,
      record_type: "OutfitDetection",
      record_ids: source_detections.map(&:id)
    )

    source_detections.each_with_object({}) do |source_detection, memo|
      target_upload = upload_map.fetch(source_detection.outfit_upload_id)
      target_detection = target_upload.outfit_detections.new(
        category: source_detection.category,
        confidence: source_detection.confidence,
        suggested_name: source_detection.suggested_name,
        details: normalize_json_value(source_detection.details),
        position: source_detection.position,
        bbox_x: source_detection.bbox_x,
        bbox_y: source_detection.bbox_y,
        bbox_width: source_detection.bbox_width,
        bbox_height: source_detection.bbox_height,
        coarse_bbox_x: source_detection.coarse_bbox_x,
        coarse_bbox_y: source_detection.coarse_bbox_y,
        coarse_bbox_width: source_detection.coarse_bbox_width,
        coarse_bbox_height: source_detection.coarse_bbox_height,
        refined_bbox_x: source_detection.refined_bbox_x,
        refined_bbox_y: source_detection.refined_bbox_y,
        refined_bbox_width: source_detection.refined_bbox_width,
        refined_bbox_height: source_detection.refined_bbox_height,
        final_bbox_x: source_detection.final_bbox_x,
        final_bbox_y: source_detection.final_bbox_y,
        final_bbox_width: source_detection.final_bbox_width,
        final_bbox_height: source_detection.final_bbox_height,
        crop_status: source_detection.crop_status,
        crop_attempts: source_detection.crop_attempts,
        crop_confidence: source_detection.crop_confidence,
        crop_notes: source_detection.crop_notes,
        crop_quality_score: source_detection.crop_quality_score,
        clean_image_status: source_detection.clean_image_status,
        clean_image_error_message: source_detection.clean_image_error_message,
        clean_image_provider: source_detection.clean_image_provider,
        clean_image_model: source_detection.clean_image_model,
        clean_image_generated_at: source_detection.clean_image_generated_at,
        clean_image_variant: optional_source_attribute(source_detection, :clean_image_variant),
        clean_image_cutout_fallback: optional_source_attribute(source_detection, :clean_image_cutout_fallback)
      )
      target_detection.save!(validate: false)
      clone_attachment!(cleaned_photo_blobs[[ source_detection.id, "cleaned_photo" ]], target_detection.cleaned_photo)
      clone_attachment!(cleaned_photo_blobs[[ source_detection.id, "cleaned_working_photo" ]], target_detection.cleaned_working_photo)
      preserve_timestamps!(target_detection, source_detection)
      memo[source_detection.id] = target_detection
    end
  end

  def import_clothing_items(source, source_user, target_user, upload_map, detection_map)
    source_items = source.clothing_items.where(user_id: source_user.id).order(:id).to_a
    item_photo_blobs = source_attachment_blobs(
      source,
      record_type: "ClothingItem",
      record_ids: source_items.map(&:id)
    )

    source_items.each_with_object({}) do |source_item, memo|
      target_item = target_user.clothing_items.new(
        name: source_item.name,
        category: source_item.category,
        brand: source_item.brand,
        size: source_item.size,
        date: source_item.date,
        tags: normalize_json_value(source_item.tags),
        source_outfit_upload_id: mapped_record_id(upload_map, source_item.source_outfit_upload_id, label: "outfit upload"),
        source_outfit_detection_id: mapped_record_id(detection_map, source_item.source_outfit_detection_id, label: "outfit detection"),
        clean_image_status: source_item.clean_image_status,
        clean_image_error_message: source_item.clean_image_error_message,
        clean_image_provider: source_item.clean_image_provider,
        clean_image_model: source_item.clean_image_model,
        clean_image_generated_at: source_item.clean_image_generated_at,
        clean_image_variant: optional_source_attribute(source_item, :clean_image_variant),
        clean_image_cutout_fallback: optional_source_attribute(source_item, :clean_image_cutout_fallback)
      )
      target_item.save!(validate: false)
      clone_attachment!(item_photo_blobs[[ source_item.id, "photo" ]], target_item.photo)
      clone_attachment!(item_photo_blobs[[ source_item.id, "cleaned_photo" ]], target_item.cleaned_photo)
      clone_attachment!(item_photo_blobs[[ source_item.id, "cleaned_working_photo" ]], target_item.cleaned_working_photo)
      preserve_timestamps!(target_item, source_item)
      memo[source_item.id] = target_item
    end
  end

  def import_outfits(source, source_user, target_user)
    source_outfits = source.outfits.where(user_id: source_user.id).order(:id).to_a

    source_outfits.each_with_object({}) do |source_outfit, memo|
      target_outfit = target_user.outfits.new(
        name: source_outfit.name,
        tags: normalize_json_value(source_outfit.tags),
        notes: source_outfit.notes
      )
      target_outfit.save!(validate: false)
      preserve_timestamps!(target_outfit, source_outfit)
      memo[source_outfit.id] = target_outfit
    end
  end

  def import_outfit_items(source, outfit_map, item_map)
    source_outfit_ids = outfit_map.keys
    return if source_outfit_ids.empty?

    source.outfit_items.where(outfit_id: source_outfit_ids).order(:outfit_id, :layer_order, :id).find_each do |source_outfit_item|
      target_outfit = outfit_map.fetch(source_outfit_item.outfit_id)
      target_item = item_map.fetch(source_outfit_item.clothing_item_id)

      target_outfit_item = target_outfit.outfit_items.new(
        clothing_item: target_item,
        layer_order: source_attribute(source_outfit_item, :layer_order) || 0,
        collage_x: source_attribute(source_outfit_item, :collage_x),
        collage_y: source_attribute(source_outfit_item, :collage_y),
        collage_width: source_attribute(source_outfit_item, :collage_width),
        collage_height: source_attribute(source_outfit_item, :collage_height),
        collage_rotation: source_attribute(source_outfit_item, :collage_rotation) || 0.0
      )
      target_outfit_item.save!(validate: false)
      preserve_timestamps!(target_outfit_item, source_outfit_item)
    end
  end

  def source_attribute(record, attribute_name)
    return unless record.has_attribute?(attribute_name)

    record.public_send(attribute_name)
  end

  def mapped_record_id(map, source_id, label:)
    return if source_id.blank?

    record = map[source_id]
    raise Error, "Missing imported #{label} for source id #{source_id}." unless record

    record.id
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
    return unless source_blob

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

  def optional_source_attribute(record, attribute_name)
    return unless record.respond_to?(attribute_name)

    record.public_send(attribute_name)
  end
end
