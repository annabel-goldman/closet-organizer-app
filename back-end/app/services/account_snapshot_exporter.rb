require "json"

class AccountSnapshotExporter
  Error = Class.new(StandardError)
  UserNotFoundError = Class.new(Error)

  def initialize(email:, output_path: nil, output_io: nil)
    @email = email.to_s.strip
    @output_path = output_path.to_s.strip.presence
    @output_io = output_io
    @attachment_copier = AccountAttachmentCopier.new
  end

  def call
    raise UserNotFoundError, "Provide a user email." if email.blank?

    user = User.where("lower(email) = ?", email.downcase).first
    raise UserNotFoundError, "No user found for #{email}." unless user

    attachment_payloads = {}
    records = serialized_records_for(user, attachment_payloads: attachment_payloads)
    manifest = build_manifest(user: user, records: records)

    AccountSnapshotManifest.validate_manifest!(manifest)
    archive_bytes = AccountSnapshotArchive.write(
      manifest: manifest,
      attachment_payloads: attachment_payloads,
      path: output_path,
      io: output_io
    )

    {
      email: user.email,
      output_path: output_path,
      archive_bytes: archive_bytes.bytesize,
      attachment_count: manifest.fetch("attachments").size,
      record_counts: manifest.fetch("record_counts"),
      manifest: manifest
    }
  end

  private

  attr_reader :email, :output_path, :output_io, :attachment_copier

  def serialized_records_for(user, attachment_payloads:)
    clothing_items = user.clothing_items.with_attached_photo.with_attached_cleaned_photo.with_attached_cleaned_working_photo.order(:id).to_a
    outfits = user.outfits.includes(:outfit_items).order(:id).to_a
    outfit_uploads = user.outfit_uploads.with_attached_source_photo.order(:id).to_a
    outfit_detections = OutfitDetection.where(outfit_upload_id: outfit_uploads.map(&:id)).with_attached_cleaned_photo.with_attached_cleaned_working_photo.order(:id).to_a

    attachments = []

    serialized = {
      "clothing_items" => clothing_items.map do |item|
        attachments.concat([
          attachment_copier.export_attachment(
            record_type: "ClothingItem",
            record_source_id: item.id,
            attachment_role: "photo",
            attachment: item.photo,
            attachment_payloads: attachment_payloads
          ),
          attachment_copier.export_attachment(
            record_type: "ClothingItem",
            record_source_id: item.id,
            attachment_role: "cleaned_photo",
            attachment: item.cleaned_photo,
            attachment_payloads: attachment_payloads
          ),
          attachment_copier.export_attachment(
            record_type: "ClothingItem",
            record_source_id: item.id,
            attachment_role: "cleaned_working_photo",
            attachment: item.cleaned_working_photo,
            attachment_payloads: attachment_payloads
          )
        ].compact)

        {
          "source_record_id" => item.id,
          "source_outfit_upload_source_id" => item.source_outfit_upload_id,
          "source_outfit_detection_source_id" => item.source_outfit_detection_id,
          "attributes" => {
            "name" => item.name,
            "category" => item.category,
            "brand" => item.brand,
            "size" => item.size,
            "date" => serialized_time(item.date),
            "tags" => normalized_json_value(item.tags),
            "clean_image_status" => item.clean_image_status,
            "clean_image_error_message" => item.clean_image_error_message,
            "clean_image_provider" => item.clean_image_provider,
            "clean_image_model" => item.clean_image_model,
            "clean_image_generated_at" => serialized_time(item.clean_image_generated_at),
            "clean_image_variant" => item.clean_image_variant,
            "clean_image_cutout_fallback" => item.clean_image_cutout_fallback,
            "created_at" => serialized_time(item.created_at),
            "updated_at" => serialized_time(item.updated_at)
          }
        }
      end,
      "outfits" => outfits.map do |outfit|
        {
          "source_record_id" => outfit.id,
          "attributes" => {
            "name" => outfit.name,
            "tags" => normalized_json_value(outfit.tags),
            "notes" => outfit.notes,
            "created_at" => serialized_time(outfit.created_at),
            "updated_at" => serialized_time(outfit.updated_at)
          }
        }
      end,
      "outfit_items" => outfits.flat_map do |outfit|
        outfit.outfit_items.order(:id).map do |outfit_item|
          {
            "source_record_id" => outfit_item.id,
            "outfit_source_record_id" => outfit_item.outfit_id,
            "clothing_item_source_record_id" => outfit_item.clothing_item_id,
            "attributes" => {
              "layer_order" => outfit_item.layer_order,
              "collage_x" => outfit_item.collage_x,
              "collage_y" => outfit_item.collage_y,
              "collage_width" => outfit_item.collage_width,
              "collage_height" => outfit_item.collage_height,
              "collage_rotation" => outfit_item.collage_rotation,
              "created_at" => serialized_time(outfit_item.created_at),
              "updated_at" => serialized_time(outfit_item.updated_at)
            }
          }
        end
      end,
      "outfit_uploads" => outfit_uploads.map do |upload|
        attachments << attachment_copier.export_attachment(
          record_type: "OutfitUpload",
          record_source_id: upload.id,
          attachment_role: "source_photo",
          attachment: upload.source_photo,
          attachment_payloads: attachment_payloads
        )

        {
          "source_record_id" => upload.id,
          "attributes" => {
            "status" => upload.status,
            "provider" => upload.provider,
            "vision_model" => upload.vision_model,
            "error_message" => upload.error_message,
            "detected_at" => serialized_time(upload.detected_at),
            "raw_response" => normalized_json_value(upload.raw_response),
            "created_at" => serialized_time(upload.created_at),
            "updated_at" => serialized_time(upload.updated_at)
          }
        }
      end,
      "outfit_detections" => outfit_detections.map do |detection|
        attachments << attachment_copier.export_attachment(
          record_type: "OutfitDetection",
          record_source_id: detection.id,
          attachment_role: "cleaned_photo",
          attachment: detection.cleaned_photo,
          attachment_payloads: attachment_payloads
        )
        attachments << attachment_copier.export_attachment(
          record_type: "OutfitDetection",
          record_source_id: detection.id,
          attachment_role: "cleaned_working_photo",
          attachment: detection.cleaned_working_photo,
          attachment_payloads: attachment_payloads
        )

        {
          "source_record_id" => detection.id,
          "outfit_upload_source_record_id" => detection.outfit_upload_id,
          "attributes" => {
            "category" => detection.category,
            "confidence" => detection.confidence,
            "suggested_name" => detection.suggested_name,
            "details" => normalized_json_value(detection.details),
            "position" => detection.position,
            "bbox_x" => detection.bbox_x,
            "bbox_y" => detection.bbox_y,
            "bbox_width" => detection.bbox_width,
            "bbox_height" => detection.bbox_height,
            "coarse_bbox_x" => detection.coarse_bbox_x,
            "coarse_bbox_y" => detection.coarse_bbox_y,
            "coarse_bbox_width" => detection.coarse_bbox_width,
            "coarse_bbox_height" => detection.coarse_bbox_height,
            "refined_bbox_x" => detection.refined_bbox_x,
            "refined_bbox_y" => detection.refined_bbox_y,
            "refined_bbox_width" => detection.refined_bbox_width,
            "refined_bbox_height" => detection.refined_bbox_height,
            "final_bbox_x" => detection.final_bbox_x,
            "final_bbox_y" => detection.final_bbox_y,
            "final_bbox_width" => detection.final_bbox_width,
            "final_bbox_height" => detection.final_bbox_height,
            "crop_status" => detection.crop_status,
            "crop_attempts" => detection.crop_attempts,
            "crop_confidence" => detection.crop_confidence,
            "crop_notes" => detection.crop_notes,
            "crop_quality_score" => detection.crop_quality_score,
            "clean_image_status" => detection.clean_image_status,
            "clean_image_error_message" => detection.clean_image_error_message,
            "clean_image_provider" => detection.clean_image_provider,
            "clean_image_model" => detection.clean_image_model,
            "clean_image_generated_at" => serialized_time(detection.clean_image_generated_at),
            "clean_image_variant" => detection.clean_image_variant,
            "clean_image_cutout_fallback" => detection.clean_image_cutout_fallback,
            "created_at" => serialized_time(detection.created_at),
            "updated_at" => serialized_time(detection.updated_at)
          }
        }
      end
    }

    {
      "records" => serialized,
      "attachments" => attachments.compact
    }
  end

  def build_manifest(user:, records:)
    record_payloads = records.fetch("records")

    {
      "version" => AccountSnapshotManifest::VERSION,
      "exported_at" => serialized_time(Time.current),
      "source" => AccountSnapshotManifest.current_source_metadata,
      "user_email" => user.email,
      "record_counts" => record_payloads.transform_values(&:size),
      "records" => record_payloads,
      "attachments" => records.fetch("attachments")
    }
  end

  def normalized_json_value(value)
    return nil if value.nil?

    JSON.parse(JSON.generate(value))
  end

  def serialized_time(value)
    value&.iso8601(6)
  end
end
