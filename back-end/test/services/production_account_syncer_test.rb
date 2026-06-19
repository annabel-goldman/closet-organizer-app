require "test_helper"
require "tmpdir"
require "sqlite3"

class ProductionAccountSyncerTest < ActiveSupport::TestCase
  def setup
    super

    @tmp_dir = Dir.mktmpdir("production-account-syncer")
    @source_db_path = File.join(@tmp_dir, "source.sqlite3")
    @source_database = SQLite3::Database.new(@source_db_path)
    build_source_schema!(@source_database)
  end

  def teardown
    @source_database&.close
    super
  end

  test "copies a production account into an existing local account and replaces owned data" do
    target_user = users(:one)
    create_stale_local_data!(target_user)

    source_user_id = 101
    source_upload_id = 201
    source_detection_id = 301
    source_item_id = 401
    source_outfit_id = 501

    insert_source_row(
      "users",
      id: source_user_id,
      username: "alex from prod",
      email: target_user.email,
      preferred_style: "polished",
      provider: "google_oauth2",
      uid: "prod-google-alex",
      avatar_url: "https://example.com/alex.png",
      admin: true,
      password_digest: "ignored",
      created_at: Time.zone.parse("2026-05-01 12:00:00"),
      updated_at: Time.zone.parse("2026-05-02 12:00:00")
    )

    insert_source_row(
      "outfit_uploads",
      id: source_upload_id,
      user_id: source_user_id,
      status: 2,
      provider: "openrouter",
      vision_model: "vision-v1",
      error_message: nil,
      detected_at: Time.zone.parse("2026-05-03 12:00:00"),
      raw_response: { "items" => 1 }.to_json,
      created_at: Time.zone.parse("2026-05-03 10:00:00"),
      updated_at: Time.zone.parse("2026-05-03 10:15:00")
    )

    insert_source_row(
      "outfit_detections",
      id: source_detection_id,
      outfit_upload_id: source_upload_id,
      category: "shirt",
      confidence: 0.97,
      suggested_name: "Striped Oxford",
      details: { "dominant_color" => "navy" }.to_json,
      position: 0,
      bbox_x: 0.1,
      bbox_y: 0.2,
      bbox_width: 0.3,
      bbox_height: 0.4,
      coarse_bbox_x: 0.1,
      coarse_bbox_y: 0.2,
      coarse_bbox_width: 0.3,
      coarse_bbox_height: 0.4,
      refined_bbox_x: 0.11,
      refined_bbox_y: 0.21,
      refined_bbox_width: 0.31,
      refined_bbox_height: 0.41,
      final_bbox_x: 0.12,
      final_bbox_y: 0.22,
      final_bbox_width: 0.32,
      final_bbox_height: 0.42,
      crop_status: 2,
      crop_attempts: 1,
      crop_confidence: 0.92,
      crop_notes: "Looks good",
      crop_quality_score: 0.88,
      clean_image_status: 2,
      clean_image_error_message: nil,
      clean_image_provider: "openrouter",
      clean_image_model: "clean-v1",
      clean_image_generated_at: Time.zone.parse("2026-05-03 13:00:00"),
      created_at: Time.zone.parse("2026-05-03 10:10:00"),
      updated_at: Time.zone.parse("2026-05-03 10:20:00")
    )

    insert_source_row(
      "clothing_items",
      id: source_item_id,
      user_id: source_user_id,
      name: "Prod Oxford",
      category: "shirt",
      brand: "j.crew",
      size: ClothingItem.sizes.fetch("medium"),
      date: Time.zone.parse("2026-04-20"),
      tags: [ "capsule", "navy" ].to_json,
      source_outfit_upload_id: source_upload_id,
      source_outfit_detection_id: source_detection_id,
      clean_image_status: 2,
      clean_image_error_message: nil,
      clean_image_provider: "openrouter",
      clean_image_model: "clean-v1",
      clean_image_generated_at: Time.zone.parse("2026-05-03 13:30:00"),
      created_at: Time.zone.parse("2026-05-03 09:00:00"),
      updated_at: Time.zone.parse("2026-05-03 09:30:00")
    )

    insert_source_row(
      "outfits",
      id: source_outfit_id,
      user_id: source_user_id,
      name: "Monday Look",
      tags: [ "office", "spring" ].to_json,
      notes: "Imported from prod",
      created_at: Time.zone.parse("2026-05-04 09:00:00"),
      updated_at: Time.zone.parse("2026-05-04 09:30:00")
    )

    insert_source_row(
      "outfit_items",
      id: 601,
      outfit_id: source_outfit_id,
      clothing_item_id: source_item_id,
      layer_order: 2,
      collage_x: 12.5,
      collage_y: 33.25,
      collage_width: 40.0,
      collage_height: 52.0,
      collage_rotation: 7.5,
      created_at: Time.zone.parse("2026-05-04 09:10:00"),
      updated_at: Time.zone.parse("2026-05-04 09:20:00")
    )

    attach_source_blob!(
      record_type: "OutfitUpload",
      record_id: source_upload_id,
      name: "source_photo",
      filename: "upload.png",
      bytes: "source-upload-bytes"
    )
    attach_source_blob!(
      record_type: "OutfitDetection",
      record_id: source_detection_id,
      name: "cleaned_photo",
      filename: "detection.png",
      bytes: "source-detection-bytes"
    )
    attach_source_blob!(
      record_type: "ClothingItem",
      record_id: source_item_id,
      name: "photo",
      filename: "item-photo.png",
      bytes: "source-item-photo"
    )
    attach_source_blob!(
      record_type: "ClothingItem",
      record_id: source_item_id,
      name: "cleaned_photo",
      filename: "item-cleaned.png",
      bytes: "source-item-cleaned"
    )

    summary = ProductionAccountSyncer.new(
      source_email: target_user.email,
      target_email: target_user.email,
      source_connection_config: { adapter: "sqlite3", database: @source_db_path },
      storage_service_name: "test"
    ).call

    target_user.reload
    imported_upload = target_user.outfit_uploads.includes(:outfit_detections).sole
    imported_detection = imported_upload.outfit_detections.sole
    imported_item = target_user.clothing_items.sole
    imported_outfit = target_user.outfits.includes(:outfit_items).sole
    imported_outfit_item = imported_outfit.outfit_items.sole

    assert_equal "alex from prod", target_user.username
    assert_equal "polished", target_user.preferred_style
    assert_equal "prod-google-alex", target_user.uid
    assert_equal true, target_user.admin
    assert_equal 1, target_user.clothing_items.count
    assert_equal 1, target_user.outfits.count
    assert_equal 1, target_user.outfit_uploads.count
    assert_equal "Prod Oxford", imported_item.name
    assert_equal "top", imported_item.category
    assert_equal [ "capsule", "navy", "shirt" ], imported_item.tags
    assert_equal imported_upload.id, imported_item.source_outfit_upload_id
    assert_equal imported_detection.id, imported_item.source_outfit_detection_id
    assert_equal "source-upload-bytes", imported_upload.source_photo.download
    assert_equal "source-detection-bytes", imported_detection.cleaned_photo.download
    assert_equal "source-item-photo", imported_item.photo.download
    assert_equal "source-item-cleaned", imported_item.cleaned_photo.download
    assert_equal "Monday Look", imported_outfit.name
    assert_equal [ "office", "spring" ], imported_outfit.tags
    assert_equal imported_item.id, imported_outfit_item.clothing_item_id
    assert_equal 12.5, imported_outfit_item.collage_x
    assert_equal 33.25, imported_outfit_item.collage_y
    assert_equal 40.0, imported_outfit_item.collage_width
    assert_equal 52.0, imported_outfit_item.collage_height
    assert_equal 7.5, imported_outfit_item.collage_rotation
    assert_equal 2, imported_outfit_item.layer_order
    assert_equal 1, summary[:clothing_items]
    assert_equal 1, summary[:outfits]
    assert_equal 1, summary[:outfit_uploads]
    assert_equal 1, summary[:outfit_detections]
    assert_equal "test", summary[:storage_service]

    assert_not ClothingItem.exists?(name: "Stale local item")
    assert_not Outfit.exists?(name: "Stale local outfit")
    assert_equal 0, OutfitDetection.where(crop_notes: "stale").count
  end

  private

  def build_source_schema!(database)
    database.execute_batch(<<~SQL)
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        username VARCHAR,
        email VARCHAR,
        preferred_style VARCHAR,
        provider VARCHAR,
        uid VARCHAR,
        avatar_url VARCHAR,
        admin BOOLEAN NOT NULL DEFAULT 0,
        password_digest VARCHAR,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL
      );

      CREATE TABLE clothing_items (
        id INTEGER PRIMARY KEY,
        name VARCHAR,
        category VARCHAR,
        brand VARCHAR,
        size INTEGER,
        date DATETIME,
        tags TEXT,
        user_id INTEGER,
        source_outfit_upload_id INTEGER,
        source_outfit_detection_id INTEGER,
        clean_image_status INTEGER,
        clean_image_error_message TEXT,
        clean_image_provider VARCHAR,
        clean_image_model VARCHAR,
        clean_image_generated_at DATETIME,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL
      );

      CREATE TABLE outfits (
        id INTEGER PRIMARY KEY,
        user_id INTEGER,
        name VARCHAR,
        tags TEXT,
        notes TEXT,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL
      );

      CREATE TABLE outfit_items (
        id INTEGER PRIMARY KEY,
        outfit_id INTEGER,
        clothing_item_id INTEGER,
        layer_order INTEGER,
        collage_x FLOAT,
        collage_y FLOAT,
        collage_width FLOAT,
        collage_height FLOAT,
        collage_rotation FLOAT,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL
      );

      CREATE TABLE outfit_uploads (
        id INTEGER PRIMARY KEY,
        user_id INTEGER,
        status INTEGER,
        provider VARCHAR,
        vision_model VARCHAR,
        error_message TEXT,
        detected_at DATETIME,
        raw_response TEXT,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL
      );

      CREATE TABLE outfit_detections (
        id INTEGER PRIMARY KEY,
        outfit_upload_id INTEGER,
        category VARCHAR,
        confidence FLOAT,
        suggested_name VARCHAR,
        details TEXT,
        position INTEGER,
        bbox_x FLOAT,
        bbox_y FLOAT,
        bbox_width FLOAT,
        bbox_height FLOAT,
        coarse_bbox_x FLOAT,
        coarse_bbox_y FLOAT,
        coarse_bbox_width FLOAT,
        coarse_bbox_height FLOAT,
        refined_bbox_x FLOAT,
        refined_bbox_y FLOAT,
        refined_bbox_width FLOAT,
        refined_bbox_height FLOAT,
        final_bbox_x FLOAT,
        final_bbox_y FLOAT,
        final_bbox_width FLOAT,
        final_bbox_height FLOAT,
        crop_status INTEGER,
        crop_attempts INTEGER,
        crop_confidence FLOAT,
        crop_notes TEXT,
        crop_quality_score FLOAT,
        clean_image_status INTEGER,
        clean_image_error_message TEXT,
        clean_image_provider VARCHAR,
        clean_image_model VARCHAR,
        clean_image_generated_at DATETIME,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL
      );

      CREATE TABLE active_storage_blobs (
        id INTEGER PRIMARY KEY,
        key VARCHAR NOT NULL,
        filename VARCHAR NOT NULL,
        content_type VARCHAR,
        metadata TEXT,
        service_name VARCHAR NOT NULL,
        byte_size BIGINT NOT NULL,
        checksum VARCHAR,
        created_at DATETIME NOT NULL
      );

      CREATE TABLE active_storage_attachments (
        id INTEGER PRIMARY KEY,
        name VARCHAR NOT NULL,
        record_type VARCHAR NOT NULL,
        record_id INTEGER NOT NULL,
        blob_id INTEGER NOT NULL,
        created_at DATETIME NOT NULL
      );
    SQL
  end

  def attach_source_blob!(record_type:, record_id:, name:, filename:, bytes:)
    local_blob = ActiveStorage::Blob.create_and_upload!(
      io: StringIO.new(bytes),
      filename: filename,
      content_type: "image/png",
      service_name: "test"
    )

    blob_id = next_source_id_for("active_storage_blobs")
    insert_source_row(
      "active_storage_blobs",
      id: blob_id,
      key: local_blob.key,
      filename: local_blob.filename.to_s,
      content_type: local_blob.content_type,
      metadata: local_blob.metadata.to_json,
      service_name: local_blob.service_name,
      byte_size: local_blob.byte_size,
      checksum: local_blob.checksum,
      created_at: local_blob.created_at
    )

    insert_source_row(
      "active_storage_attachments",
      id: next_source_id_for("active_storage_attachments"),
      name: name,
      record_type: record_type,
      record_id: record_id,
      blob_id: blob_id,
      created_at: Time.current
    )
  end

  def insert_source_row(table_name, attributes)
    columns = attributes.keys.map(&:to_s)
    placeholders = Array.new(columns.length, "?").join(", ")
    values = columns.map { |column| sqlite_value(attributes.fetch(column.to_sym)) }

    @source_database.execute(
      "INSERT INTO #{table_name} (#{columns.join(', ')}) VALUES (#{placeholders})",
      values
    )
  end

  def next_source_id_for(table_name)
    @source_database.get_first_value("SELECT COUNT(*) FROM #{table_name}").to_i + 1
  end

  def sqlite_value(value)
    case value
    when TrueClass then 1
    when FalseClass then 0
    when ActiveSupport::TimeWithZone then value.to_fs(:db)
    when Time, Date, DateTime then value.to_fs(:db)
    else
      value
    end
  end

  def create_stale_local_data!(target_user)
    stale_item = target_user.clothing_items.create!(
      name: "Stale local item",
      category: "pants",
      size: :medium,
      tags: [ "stale" ]
    )
    stale_item.photo.attach(
      io: StringIO.new("stale-item-photo"),
      filename: "stale-item.png",
      content_type: "image/png"
    )

    stale_upload = target_user.outfit_uploads.new(
      status: :succeeded,
      provider: "openrouter",
      vision_model: "stale-model"
    )
    stale_upload.save!(validate: false)
    stale_upload.source_photo.attach(
      io: StringIO.new("stale-upload-photo"),
      filename: "stale-upload.png",
      content_type: "image/png"
    )

    stale_detection = stale_upload.outfit_detections.new(
      category: "shirt",
      position: 0,
      crop_attempts: 0,
      crop_status: :pending,
      crop_notes: "stale",
      clean_image_status: :idle
    )
    stale_detection.save!(validate: false)
    stale_detection.cleaned_photo.attach(
      io: StringIO.new("stale-detection-photo"),
      filename: "stale-detection.png",
      content_type: "image/png"
    )

    stale_outfit = target_user.outfits.create!(name: "Stale local outfit", tags: [ "stale" ])
    stale_outfit.outfit_items.create!(clothing_item: stale_item, layer_order: 0)
  end
end
