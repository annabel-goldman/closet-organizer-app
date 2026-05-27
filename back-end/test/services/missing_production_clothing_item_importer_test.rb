require "test_helper"
require "tmpdir"
require "sqlite3"
require "stringio"

class MissingProductionClothingItemImporterTest < ActiveSupport::TestCase
  def setup
    super

    @tmp_dir = Dir.mktmpdir("missing-production-clothing-item-importer")
    @source_db_path = File.join(@tmp_dir, "source.sqlite3")
    @source_database = SQLite3::Database.new(@source_db_path)
    build_source_schema!(@source_database)
  end

  def teardown
    @source_database&.close
    super
  end

  test "imports only source items whose original photo does not already exist locally" do
    target_user = users(:one)
    existing_local_item = clothing_items(:one)
    existing_local_item.photo.attach(local_photo_upload_png)

    source_user_id = 101
    existing_source_item_id = 201
    missing_source_item_id = 202

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
      "clothing_items",
      id: existing_source_item_id,
      user_id: source_user_id,
      name: "Already Local in Source",
      category: "shirt",
      brand: "source brand",
      size: ClothingItem.sizes.fetch("medium"),
      date: Time.zone.parse("2026-05-10"),
      tags: [ "shared" ].to_json,
      created_at: Time.zone.parse("2026-05-10 09:00:00"),
      updated_at: Time.zone.parse("2026-05-10 09:30:00")
    )
    attach_source_blob!(
      record_type: "ClothingItem",
      record_id: existing_source_item_id,
      name: "photo",
      filename: "shared-photo.png",
      bytes: File.binread(file_fixture("item-photo.png"))
    )

    insert_source_row(
      "clothing_items",
      id: missing_source_item_id,
      user_id: source_user_id,
      name: "New From Prod",
      category: "dress",
      brand: "source atelier",
      size: ClothingItem.sizes.fetch("small"),
      date: Time.zone.parse("2026-05-11"),
      tags: [ "new", "prod" ].to_json,
      created_at: Time.zone.parse("2026-05-11 10:00:00"),
      updated_at: Time.zone.parse("2026-05-11 10:30:00")
    )
    attach_source_blob!(
      record_type: "ClothingItem",
      record_id: missing_source_item_id,
      name: "photo",
      filename: "new-photo.png",
      bytes: "different-photo-bytes"
    )

    summary = MissingProductionClothingItemImporter.new(
      source_email: target_user.email,
      target_email: target_user.email,
      source_connection_config: { adapter: "sqlite3", database: @source_db_path },
      storage_service_name: "test"
    ).call

    imported_item = ClothingItem.find(summary[:imported_item_ids].sole)

    assert_equal 2, summary[:total_source_items]
    assert_equal 1, summary[:imported]
    assert_equal 1, summary[:skipped_existing]
    assert_equal 0, summary[:skipped_without_source_photo]
    assert_equal "New From Prod", imported_item.name
    assert_equal "dress", imported_item.category
    assert_equal "source atelier", imported_item.brand
    assert_equal [ "new", "prod" ], imported_item.tags
    assert_predicate imported_item.photo, :attached?
    assert_not imported_item.cleaned_photo.attached?
    assert_equal 2, target_user.clothing_items.count
  end

  test "raises when the local target user does not exist" do
    insert_source_row(
      "users",
      id: 101,
      username: "prod-only",
      email: "prod-only@example.com",
      preferred_style: "polished",
      provider: "google_oauth2",
      uid: "prod-only",
      avatar_url: "https://example.com/prod-only.png",
      admin: false,
      password_digest: "ignored",
      created_at: Time.zone.parse("2026-05-01 12:00:00"),
      updated_at: Time.zone.parse("2026-05-02 12:00:00")
    )

    error = assert_raises(MissingProductionClothingItemImporter::TargetUserNotFoundError) do
      MissingProductionClothingItemImporter.new(
        source_email: "prod-only@example.com",
        target_email: "missing-local@example.com",
        source_connection_config: { adapter: "sqlite3", database: @source_db_path },
        storage_service_name: "test"
      ).call
    end

    assert_match(/No local user found/, error.message)
  end

  private

  def local_photo_upload_png
    Rack::Test::UploadedFile.new(file_fixture("item-photo.png"), "image/png")
  end

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
end
