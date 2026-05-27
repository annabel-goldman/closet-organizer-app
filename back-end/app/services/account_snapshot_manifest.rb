require "digest"
require "json"
require "set"

class AccountSnapshotManifest
  Error = Class.new(StandardError)
  ValidationError = Class.new(Error)

  VERSION = 2

  ATTACHMENT_ROLES = {
    "ClothingItem" => %w[photo cleaned_photo cleaned_working_photo],
    "OutfitUpload" => %w[source_photo],
    "OutfitDetection" => %w[cleaned_photo cleaned_working_photo]
  }.freeze

  RECORD_DEFINITIONS = {
    "clothing_items" => {
      "record_type" => "ClothingItem",
      "model_name" => "ClothingItem",
      "columns" => %w[
        user_id
        name
        category
        brand
        size
        date
        tags
        source_outfit_upload_id
        source_outfit_detection_id
        clean_image_status
        clean_image_error_message
        clean_image_provider
        clean_image_model
        clean_image_generated_at
        clean_image_variant
        clean_image_cutout_fallback
        created_at
        updated_at
      ],
      "attribute_keys" => %w[
        name
        category
        brand
        size
        date
        tags
        clean_image_status
        clean_image_error_message
        clean_image_provider
        clean_image_model
        clean_image_generated_at
        clean_image_variant
        clean_image_cutout_fallback
        created_at
        updated_at
      ],
      "required_keys" => %w[source_record_id attributes source_outfit_upload_source_id source_outfit_detection_source_id],
      "attachment_roles" => ATTACHMENT_ROLES.fetch("ClothingItem"),
      "enum_requirements" => {
        "size" => %w[xs small medium large xl na],
        "clean_image_status" => %w[idle processing succeeded failed]
      }
    },
    "outfits" => {
      "record_type" => "Outfit",
      "model_name" => "Outfit",
      "columns" => %w[user_id name tags notes created_at updated_at],
      "attribute_keys" => %w[name tags notes created_at updated_at],
      "required_keys" => %w[source_record_id attributes],
      "attachment_roles" => [],
      "enum_requirements" => {}
    },
    "outfit_items" => {
      "record_type" => "OutfitItem",
      "model_name" => "OutfitItem",
      "columns" => %w[
        outfit_id
        clothing_item_id
        layer_order
        collage_x
        collage_y
        collage_width
        collage_height
        collage_rotation
        created_at
        updated_at
      ],
      "attribute_keys" => %w[
        layer_order
        collage_x
        collage_y
        collage_width
        collage_height
        collage_rotation
        created_at
        updated_at
      ],
      "required_keys" => %w[source_record_id attributes outfit_source_record_id clothing_item_source_record_id],
      "attachment_roles" => [],
      "enum_requirements" => {}
    },
    "outfit_uploads" => {
      "record_type" => "OutfitUpload",
      "model_name" => "OutfitUpload",
      "columns" => %w[
        user_id
        status
        provider
        vision_model
        error_message
        detected_at
        raw_response
        created_at
        updated_at
      ],
      "attribute_keys" => %w[
        status
        provider
        vision_model
        error_message
        detected_at
        raw_response
        created_at
        updated_at
      ],
      "required_keys" => %w[source_record_id attributes],
      "attachment_roles" => ATTACHMENT_ROLES.fetch("OutfitUpload"),
      "enum_requirements" => {
        "status" => %w[pending processing succeeded failed]
      }
    },
    "outfit_detections" => {
      "record_type" => "OutfitDetection",
      "model_name" => "OutfitDetection",
      "columns" => %w[
        outfit_upload_id
        category
        confidence
        suggested_name
        details
        position
        bbox_x
        bbox_y
        bbox_width
        bbox_height
        coarse_bbox_x
        coarse_bbox_y
        coarse_bbox_width
        coarse_bbox_height
        refined_bbox_x
        refined_bbox_y
        refined_bbox_width
        refined_bbox_height
        final_bbox_x
        final_bbox_y
        final_bbox_width
        final_bbox_height
        crop_status
        crop_attempts
        crop_confidence
        crop_notes
        crop_quality_score
        clean_image_status
        clean_image_error_message
        clean_image_provider
        clean_image_model
        clean_image_generated_at
        clean_image_variant
        clean_image_cutout_fallback
        created_at
        updated_at
      ],
      "attribute_keys" => %w[
        category
        confidence
        suggested_name
        details
        position
        bbox_x
        bbox_y
        bbox_width
        bbox_height
        coarse_bbox_x
        coarse_bbox_y
        coarse_bbox_width
        coarse_bbox_height
        refined_bbox_x
        refined_bbox_y
        refined_bbox_width
        refined_bbox_height
        final_bbox_x
        final_bbox_y
        final_bbox_width
        final_bbox_height
        crop_status
        crop_attempts
        crop_confidence
        crop_notes
        crop_quality_score
        clean_image_status
        clean_image_error_message
        clean_image_provider
        clean_image_model
        clean_image_generated_at
        clean_image_variant
        clean_image_cutout_fallback
        created_at
        updated_at
      ],
      "required_keys" => %w[source_record_id attributes outfit_upload_source_record_id],
      "attachment_roles" => ATTACHMENT_ROLES.fetch("OutfitDetection"),
      "enum_requirements" => {
        "crop_status" => %w[pending refined verified rejected failed],
        "clean_image_status" => %w[idle processing succeeded failed]
      }
    }
  }.freeze

  ROOT_KEYS = %w[version exported_at source user_email record_counts records attachments].freeze

  class << self
    def current_source_metadata
      {
        "rails_env" => Rails.env,
        "schema_version" => current_schema_version,
        "active_storage_service" => Rails.application.config.active_storage.service.to_s
      }
    end

    def current_schema_version
      ActiveRecord::Base.connection.migration_context.current_version
    rescue StandardError
      nil
    end

    def validate_loaded_snapshot!(manifest:, files:)
      validate_manifest!(manifest)
      validate_archive_payloads!(manifest: manifest, files: files)
      manifest
    end

    def validate_manifest!(manifest)
      raise ValidationError, "Snapshot manifest must be a JSON object." unless manifest.is_a?(Hash)

      missing_root_keys = ROOT_KEYS - manifest.keys
      raise ValidationError, "Snapshot manifest is missing keys: #{missing_root_keys.join(', ')}." if missing_root_keys.any?

      unless manifest["version"] == VERSION
        raise ValidationError, "Unsupported snapshot version #{manifest['version'].inspect}. Expected #{VERSION}."
      end

      validate_source_metadata!(manifest.fetch("source"))

      unless manifest["user_email"].to_s.strip.present?
        raise ValidationError, "Snapshot manifest is missing the source user email."
      end

      records = manifest.fetch("records")
      unless records.is_a?(Hash)
        raise ValidationError, "Snapshot manifest records payload must be an object."
      end

      record_counts = manifest.fetch("record_counts")
      unless record_counts.is_a?(Hash)
        raise ValidationError, "Snapshot manifest record_counts payload must be an object."
      end

      record_ids_by_type = {}

      RECORD_DEFINITIONS.each do |record_key, definition|
        record_entries = records[record_key]
        unless record_entries.is_a?(Array)
          raise ValidationError, "Snapshot manifest #{record_key} payload must be an array."
        end

        if record_counts[record_key] != record_entries.size
          raise ValidationError, "Snapshot record_counts for #{record_key} does not match the serialized records."
        end

        record_ids_by_type[definition.fetch("record_type")] = record_entries.map do |entry|
          validate_record_entry!(record_key: record_key, definition: definition, entry: entry)
        end.to_set
      end

      attachments = manifest.fetch("attachments")
      unless attachments.is_a?(Array)
        raise ValidationError, "Snapshot manifest attachments payload must be an array."
      end

      attachments.each do |entry|
        validate_attachment_entry!(entry: entry, record_ids_by_type: record_ids_by_type)
      end

      true
    end

    def validate_archive_payloads!(manifest:, files:)
      missing_paths = []
      mismatched_payloads = []

      Array(manifest["attachments"]).each do |attachment_entry|
        archive_path = attachment_entry.fetch("archive_path")
        payload = files[archive_path]

        if payload.nil?
          missing_paths << archive_path
          next
        end

        payload_size = payload.bytesize
        payload_sha = Digest::SHA256.hexdigest(payload)

        if payload_size != attachment_entry["byte_size"] || payload_sha != attachment_entry["sha256"]
          mismatched_payloads << archive_path
        end
      end

      if missing_paths.any?
        raise ValidationError, "Snapshot archive is missing attachment payloads: #{missing_paths.sort.join(', ')}."
      end

      return if mismatched_payloads.empty?

      raise ValidationError, "Snapshot archive has corrupted attachment payloads: #{mismatched_payloads.sort.join(', ')}."
    end

    def validate_target_schema!
      RECORD_DEFINITIONS.each_value do |definition|
        model = definition.fetch("model_name").constantize
        missing_columns = definition.fetch("columns") - model.column_names
        if missing_columns.any?
          raise ValidationError, "#{model.name} is missing required columns: #{missing_columns.join(', ')}."
        end

        missing_attachments = definition.fetch("attachment_roles") - attachment_reflection_names_for(model)
        if missing_attachments.any?
          raise ValidationError, "#{model.name} is missing required Active Storage attachments: #{missing_attachments.join(', ')}."
        end

        definition.fetch("enum_requirements").each do |enum_name, required_values|
          available_values = model.defined_enums.fetch(enum_name, {}).keys
          missing_values = required_values - available_values
          next if missing_values.empty?

          raise ValidationError, "#{model.name} is missing required enum values for #{enum_name}: #{missing_values.join(', ')}."
        end
      end

      true
    end

    def confirmation_token(manifest:, target_email:, target_environment:)
      digest_input = {
        version: manifest["version"],
        exported_at: manifest["exported_at"],
        source_env: manifest.dig("source", "rails_env"),
        source_email: manifest["user_email"],
        target_email: target_email.to_s.downcase,
        target_environment: target_environment.to_s,
        record_counts: manifest["record_counts"],
        attachment_count: Array(manifest["attachments"]).size
      }

      Digest::SHA256.hexdigest(JSON.generate(digest_input))[0, 12].upcase
    end

    def requires_confirmation?(target_environment)
      target_environment.to_s == "production"
    end

    def record_key_for(record_type)
      RECORD_DEFINITIONS.find { |_record_key, definition| definition["record_type"] == record_type }&.first
    end

    private

    def validate_source_metadata!(source_metadata)
      unless source_metadata.is_a?(Hash)
        raise ValidationError, "Snapshot manifest source payload must be an object."
      end

      %w[rails_env schema_version active_storage_service].each do |key|
        raise ValidationError, "Snapshot manifest source payload is missing #{key}." unless source_metadata.key?(key)
      end
    end

    def validate_record_entry!(record_key:, definition:, entry:)
      unless entry.is_a?(Hash)
        raise ValidationError, "Snapshot #{record_key} entries must be objects."
      end

      missing_keys = definition.fetch("required_keys") - entry.keys
      if missing_keys.any?
        raise ValidationError, "Snapshot #{record_key} entry is missing keys: #{missing_keys.join(', ')}."
      end

      attributes = entry["attributes"]
      unless attributes.is_a?(Hash)
        raise ValidationError, "Snapshot #{record_key} entry attributes must be an object."
      end

      missing_attribute_keys = definition.fetch("attribute_keys") - attributes.keys
      if missing_attribute_keys.any?
        raise ValidationError, "Snapshot #{record_key} entry is missing attribute keys: #{missing_attribute_keys.join(', ')}."
      end

      coerce_integer(entry["source_record_id"], "Snapshot #{record_key} source_record_id")
    end

    def validate_attachment_entry!(entry:, record_ids_by_type:)
      unless entry.is_a?(Hash)
        raise ValidationError, "Snapshot attachment entries must be objects."
      end

      required_keys = %w[
        record_type
        record_source_id
        attachment_role
        filename
        content_type
        byte_size
        checksum
        sha256
        archive_path
        metadata
      ]
      missing_keys = required_keys - entry.keys
      if missing_keys.any?
        raise ValidationError, "Snapshot attachment entry is missing keys: #{missing_keys.join(', ')}."
      end

      record_type = entry["record_type"]
      allowed_roles = ATTACHMENT_ROLES.fetch(record_type) do
        raise ValidationError, "Snapshot attachment entry references unsupported record type #{record_type.inspect}."
      end

      attachment_role = entry["attachment_role"]
      unless allowed_roles.include?(attachment_role)
        raise ValidationError, "Snapshot attachment role #{attachment_role.inspect} is invalid for #{record_type}."
      end

      record_source_id = coerce_integer(entry["record_source_id"], "Snapshot attachment record_source_id")
      unless record_ids_by_type.fetch(record_type, Set.new).include?(record_source_id)
        raise ValidationError, "Snapshot attachment #{record_type}##{record_source_id} #{attachment_role} does not reference a serialized record."
      end

      coerce_integer(entry["byte_size"], "Snapshot attachment byte_size")

      unless entry["metadata"].is_a?(Hash)
        raise ValidationError, "Snapshot attachment metadata must be an object."
      end
    end

    def coerce_integer(value, label)
      coerced =
        if value.is_a?(Integer)
          value
        elsif value.is_a?(String)
          Integer(value, exception: false)
        end

      return coerced if coerced.is_a?(Integer)

      raise ValidationError, "#{label} must be an integer."
    end

    def attachment_reflection_names_for(model)
      return [] unless model.respond_to?(:attachment_reflections)

      model.attachment_reflections.keys.map(&:to_s)
    end
  end
end
