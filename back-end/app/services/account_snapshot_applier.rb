class AccountSnapshotApplier
  Error = Class.new(StandardError)
  TargetUserNotFoundError = Class.new(Error)
  ConfirmationTokenError = Class.new(Error)

  def initialize(target_email:, confirmation_token: nil, snapshot_path: nil, snapshot_io: nil,
                 storage_service_name: nil, target_environment: Rails.env)
    @target_email = target_email.to_s.strip
    @confirmation_token = confirmation_token.to_s.strip.presence
    @snapshot_path = snapshot_path.to_s.strip.presence
    @snapshot_io = snapshot_io
    @target_environment = target_environment.to_s
    @attachment_copier = AccountAttachmentCopier.new(storage_service_name: storage_service_name)
  end

  def call
    raise Error, "Provide a target user email." if target_email.blank?

    loaded_snapshot = AccountSnapshotArchive.load(path: snapshot_path, io: snapshot_io)
    manifest = AccountSnapshotManifest.validate_loaded_snapshot!(
      manifest: loaded_snapshot.manifest,
      files: loaded_snapshot.files
    )
    AccountSnapshotManifest.validate_target_schema!

    target_user = User.where("lower(email) = ?", target_email.downcase).first
    raise TargetUserNotFoundError, "No target user found for #{target_email}." unless target_user

    validate_confirmation_token!(manifest)

    before_counts = preview_counts_for(target_user)
    attachment_entries = Array(manifest["attachments"]).group_by { |entry| [ entry["record_type"], entry["record_source_id"] ] }
    after_counts = nil

    ActiveRecord::Base.transaction do
      remove_target_account_data!(target_user)

      upload_map = import_outfit_uploads!(
        target_user: target_user,
        upload_entries: manifest.dig("records", "outfit_uploads"),
        attachment_entries: attachment_entries,
        files: loaded_snapshot.files
      )
      detection_map = import_outfit_detections!(
        detection_entries: manifest.dig("records", "outfit_detections"),
        outfit_upload_map: upload_map,
        attachment_entries: attachment_entries,
        files: loaded_snapshot.files
      )
      item_map = import_clothing_items!(
        target_user: target_user,
        item_entries: manifest.dig("records", "clothing_items"),
        outfit_upload_map: upload_map,
        outfit_detection_map: detection_map,
        attachment_entries: attachment_entries,
        files: loaded_snapshot.files
      )
      outfit_map = import_outfits!(
        target_user: target_user,
        outfit_entries: manifest.dig("records", "outfits")
      )
      import_outfit_items!(
        outfit_item_entries: manifest.dig("records", "outfit_items"),
        outfit_map: outfit_map,
        clothing_item_map: item_map
      )

      after_counts = preview_counts_for(target_user)
    end

    {
      source_email: manifest["user_email"],
      target_email: target_user.email,
      target_user_id: target_user.id,
      target_environment: target_environment,
      storage_service: attachment_copier.storage_service_name,
      record_counts: {
        snapshot: manifest.fetch("record_counts"),
        deleted: before_counts,
        applied: after_counts
      },
      attachment_count: Array(manifest["attachments"]).size
    }
  end

  private

  attr_reader :target_email, :confirmation_token, :snapshot_path, :snapshot_io, :target_environment, :attachment_copier

  def import_outfit_uploads!(target_user:, upload_entries:, attachment_entries:, files:)
    Array(upload_entries).each_with_object({}) do |entry, memo|
      attributes = entry.fetch("attributes")
      target_upload = target_user.outfit_uploads.new(
        status: attributes["status"],
        provider: attributes["provider"],
        vision_model: attributes["vision_model"],
        error_message: attributes["error_message"],
        detected_at: attributes["detected_at"],
        raw_response: attributes["raw_response"]
      )
      target_upload.save!(validate: false)
      attach_record_attachments!(
        record_type: "OutfitUpload",
        source_record_id: entry.fetch("source_record_id"),
        target_record: target_upload,
        attachment_entries: attachment_entries,
        files: files
      )
      preserve_timestamps!(target_upload, attributes)
      memo[entry.fetch("source_record_id")] = target_upload
    end
  end

  def import_outfit_detections!(detection_entries:, outfit_upload_map:, attachment_entries:, files:)
    Array(detection_entries).each_with_object({}) do |entry, memo|
      attributes = entry.fetch("attributes")
      target_upload = outfit_upload_map.fetch(entry.fetch("outfit_upload_source_record_id")) do
        raise Error, "Snapshot detection references missing outfit upload #{entry['outfit_upload_source_record_id']}."
      end

      target_detection = target_upload.outfit_detections.new(
        category: attributes["category"],
        confidence: attributes["confidence"],
        suggested_name: attributes["suggested_name"],
        details: attributes["details"],
        position: attributes["position"],
        bbox_x: attributes["bbox_x"],
        bbox_y: attributes["bbox_y"],
        bbox_width: attributes["bbox_width"],
        bbox_height: attributes["bbox_height"],
        coarse_bbox_x: attributes["coarse_bbox_x"],
        coarse_bbox_y: attributes["coarse_bbox_y"],
        coarse_bbox_width: attributes["coarse_bbox_width"],
        coarse_bbox_height: attributes["coarse_bbox_height"],
        refined_bbox_x: attributes["refined_bbox_x"],
        refined_bbox_y: attributes["refined_bbox_y"],
        refined_bbox_width: attributes["refined_bbox_width"],
        refined_bbox_height: attributes["refined_bbox_height"],
        final_bbox_x: attributes["final_bbox_x"],
        final_bbox_y: attributes["final_bbox_y"],
        final_bbox_width: attributes["final_bbox_width"],
        final_bbox_height: attributes["final_bbox_height"],
        crop_status: attributes["crop_status"],
        crop_attempts: attributes["crop_attempts"],
        crop_confidence: attributes["crop_confidence"],
        crop_notes: attributes["crop_notes"],
        crop_quality_score: attributes["crop_quality_score"],
        clean_image_status: attributes["clean_image_status"],
        clean_image_error_message: attributes["clean_image_error_message"],
        clean_image_provider: attributes["clean_image_provider"],
        clean_image_model: attributes["clean_image_model"],
        clean_image_generated_at: attributes["clean_image_generated_at"]
      )
      target_detection.save!(validate: false)
      attach_record_attachments!(
        record_type: "OutfitDetection",
        source_record_id: entry.fetch("source_record_id"),
        target_record: target_detection,
        attachment_entries: attachment_entries,
        files: files
      )
      preserve_timestamps!(target_detection, attributes)
      memo[entry.fetch("source_record_id")] = target_detection
    end
  end

  def import_clothing_items!(target_user:, item_entries:, outfit_upload_map:, outfit_detection_map:, attachment_entries:, files:)
    Array(item_entries).each_with_object({}) do |entry, memo|
      attributes = entry.fetch("attributes")
      target_item = target_user.clothing_items.new(
        name: attributes["name"],
        category: attributes["category"],
        brand: attributes["brand"],
        size: attributes["size"],
        date: attributes["date"],
        tags: attributes["tags"],
        source_outfit_upload_id: outfit_upload_map[entry["source_outfit_upload_source_id"]]&.id,
        source_outfit_detection_id: outfit_detection_map[entry["source_outfit_detection_source_id"]]&.id,
        clean_image_status: attributes["clean_image_status"],
        clean_image_error_message: attributes["clean_image_error_message"],
        clean_image_provider: attributes["clean_image_provider"],
        clean_image_model: attributes["clean_image_model"],
        clean_image_generated_at: attributes["clean_image_generated_at"]
      )
      target_item.save!(validate: false)
      attach_record_attachments!(
        record_type: "ClothingItem",
        source_record_id: entry.fetch("source_record_id"),
        target_record: target_item,
        attachment_entries: attachment_entries,
        files: files
      )
      preserve_timestamps!(target_item, attributes)
      memo[entry.fetch("source_record_id")] = target_item
    end
  end

  def import_outfits!(target_user:, outfit_entries:)
    Array(outfit_entries).each_with_object({}) do |entry, memo|
      attributes = entry.fetch("attributes")
      target_outfit = target_user.outfits.new(
        name: attributes["name"],
        tags: attributes["tags"],
        notes: attributes["notes"]
      )
      target_outfit.save!(validate: false)
      preserve_timestamps!(target_outfit, attributes)
      memo[entry.fetch("source_record_id")] = target_outfit
    end
  end

  def import_outfit_items!(outfit_item_entries:, outfit_map:, clothing_item_map:)
    Array(outfit_item_entries).each do |entry|
      attributes = entry.fetch("attributes")
      target_outfit = outfit_map.fetch(entry.fetch("outfit_source_record_id")) do
        raise Error, "Snapshot outfit item references missing outfit #{entry['outfit_source_record_id']}."
      end
      target_item = clothing_item_map.fetch(entry.fetch("clothing_item_source_record_id")) do
        raise Error, "Snapshot outfit item references missing clothing item #{entry['clothing_item_source_record_id']}."
      end

      outfit_item = target_outfit.outfit_items.new(
        clothing_item: target_item,
        layer_order: attributes["layer_order"],
        collage_x: attributes["collage_x"],
        collage_y: attributes["collage_y"],
        collage_width: attributes["collage_width"],
        collage_height: attributes["collage_height"],
        collage_rotation: attributes["collage_rotation"]
      )
      outfit_item.save!(validate: false)
      preserve_timestamps!(outfit_item, attributes)
    end
  end

  def attach_record_attachments!(record_type:, source_record_id:, target_record:, attachment_entries:, files:)
    Array(attachment_entries[[ record_type, source_record_id ]]).each do |attachment_entry|
      target_attachment = target_record.public_send(attachment_entry.fetch("attachment_role"))
      attachment_copier.attach_snapshot_attachment!(
        attachment_entry: attachment_entry,
        files: files,
        target_attachment: target_attachment
      )
    end
  end

  def preserve_timestamps!(target_record, attributes)
    target_record.update_columns(
      created_at: attributes["created_at"],
      updated_at: attributes["updated_at"]
    )
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
    OutfitDetection.where(id: outfit_detection_ids).delete_all if outfit_detection_ids.any?
    OutfitUpload.delete(outfit_upload_ids) if outfit_upload_ids.any?
  end

  # Use row deletes instead of purge so a sync never deletes remote files from
  # whichever storage service the target environment already uses.
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

  def validate_confirmation_token!(manifest)
    return unless AccountSnapshotManifest.requires_confirmation?(target_environment)

    expected_token = AccountSnapshotManifest.confirmation_token(
      manifest: manifest,
      target_email: target_email,
      target_environment: target_environment
    )
    return if confirmation_token == expected_token

    raise ConfirmationTokenError, "Confirmation token required for production apply. Expected #{expected_token}."
  end

  def preview_counts_for(target_user)
    outfit_upload_ids = target_user.outfit_uploads.pluck(:id)

    {
      "clothing_items" => target_user.clothing_items.count,
      "outfits" => target_user.outfits.count,
      "outfit_items" => OutfitItem.joins(:outfit).where(outfits: { user_id: target_user.id }).count,
      "outfit_uploads" => target_user.outfit_uploads.count,
      "outfit_detections" => OutfitDetection.where(outfit_upload_id: outfit_upload_ids).count
    }
  end
end
