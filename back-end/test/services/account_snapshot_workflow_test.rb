require "test_helper"
require "tmpdir"
require "stringio"

class AccountSnapshotWorkflowTest < ActiveSupport::TestCase
  def setup
    super
    @tmp_dir = Dir.mktmpdir("account-snapshot-workflow")
  end

  def teardown
    FileUtils.remove_entry(@tmp_dir) if @tmp_dir && Dir.exist?(@tmp_dir)
    super
  end

  test "export builds a valid snapshot archive for a full owned-content account" do
    source_user, records = create_source_account!
    snapshot_path = export_snapshot_for(source_user.email)

    loaded_snapshot = AccountSnapshotArchive.load(path: snapshot_path)
    manifest = loaded_snapshot.manifest

    assert AccountSnapshotManifest.validate_loaded_snapshot!(manifest: manifest, files: loaded_snapshot.files)
    assert_equal source_user.email, manifest["user_email"]
    assert_equal 1, manifest.dig("record_counts", "clothing_items")
    assert_equal 1, manifest.dig("record_counts", "outfits")
    assert_equal 1, manifest.dig("record_counts", "outfit_items")
    assert_equal 1, manifest.dig("record_counts", "outfit_uploads")
    assert_equal 1, manifest.dig("record_counts", "outfit_detections")
    assert_equal 6, manifest["attachments"].size

    roles = manifest["attachments"].map { |entry| [ entry["record_type"], entry["attachment_role"] ] }
    assert_includes roles, [ "ClothingItem", "photo" ]
    assert_includes roles, [ "ClothingItem", "cleaned_photo" ]
    assert_includes roles, [ "ClothingItem", "cleaned_working_photo" ]
    assert_includes roles, [ "OutfitUpload", "source_photo" ]
    assert_includes roles, [ "OutfitDetection", "cleaned_photo" ]
    assert_includes roles, [ "OutfitDetection", "cleaned_working_photo" ]

    item_entry = manifest.dig("records", "clothing_items").sole
    assert_equal records[:outfit_upload].id, item_entry["source_outfit_upload_source_id"]
    assert_equal records[:outfit_detection].id, item_entry["source_outfit_detection_source_id"]
  end

  test "preview reports hard-replace counts and returns a production confirmation token" do
    source_user, = create_source_account!
    snapshot_path = export_snapshot_for(source_user.email)
    target_user = create_target_user!(email: "preview-target@example.com")
    create_stale_target_data!(target_user)

    summary = AccountSnapshotPreviewer.new(
      target_email: target_user.email,
      snapshot_path: snapshot_path,
      target_environment: "production"
    ).call

    assert_equal source_user.email, summary[:source_email]
    assert_equal target_user.email, summary[:target_email]
    assert_equal true, summary[:target_user_exists]
    assert_equal 1, summary.dig(:record_counts, :snapshot, "clothing_items")
    assert_equal 1, summary.dig(:record_counts, :target, "clothing_items")
    assert_equal 1, summary.dig(:record_counts, :will_delete, "outfit_uploads")
    assert_equal 1, summary.dig(:record_counts, :will_create, "outfit_detections")
    assert_equal 6, summary[:attachment_count]
    assert_equal true, summary[:requires_confirmation]
    assert_match(/\A[A-F0-9]{12}\z/, summary[:confirmation_token])
  end

  test "apply hard-replaces target owned content, preserves target identity fields, and is idempotent" do
    source_user, source_records = create_source_account!
    snapshot_path = export_snapshot_for(source_user.email)
    target_user = create_target_user!(
      email: "mirror-target@example.com",
      username: "target-account",
      provider: "google_oauth2",
      uid: "target-uid",
      preferred_style: "target-style",
      avatar_url: "https://example.com/target.png",
      admin: true
    )
    create_stale_target_data!(target_user)

    summary = AccountSnapshotApplier.new(
      target_email: target_user.email,
      snapshot_path: snapshot_path
    ).call

    target_user.reload
    imported_upload = target_user.outfit_uploads.includes(:outfit_detections).sole
    imported_detection = imported_upload.outfit_detections.sole
    imported_item = target_user.clothing_items.sole
    imported_outfit = target_user.outfits.includes(:outfit_items).sole
    imported_outfit_item = imported_outfit.outfit_items.sole

    assert_equal "target-account", target_user.username
    assert_equal "google_oauth2", target_user.provider
    assert_equal "target-uid", target_user.uid
    assert_equal "target-style", target_user.preferred_style
    assert_equal "https://example.com/target.png", target_user.avatar_url
    assert_equal true, target_user.admin

    assert_equal 1, target_user.clothing_items.count
    assert_equal 1, target_user.outfits.count
    assert_equal 1, target_user.outfit_uploads.count
    assert_equal 1, OutfitDetection.where(outfit_upload_id: imported_upload.id).count
    assert_equal "Source Shirt", imported_item.name
    assert_equal source_records[:item].tags, imported_item.tags
    assert_equal imported_upload.id, imported_item.source_outfit_upload_id
    assert_equal imported_detection.id, imported_item.source_outfit_detection_id
    assert_equal "source-upload-photo", imported_upload.source_photo.download
    assert_equal "source-detection-cleaned", imported_detection.cleaned_photo.download
    assert_equal "source-detection-working", imported_detection.cleaned_working_photo.download
    assert_equal "source-item-photo", imported_item.photo.download
    assert_equal "source-item-cleaned", imported_item.cleaned_photo.download
    assert_equal "source-item-working", imported_item.cleaned_working_photo.download
    assert_equal "cleaned", imported_detection.clean_image_variant
    assert_equal false, imported_detection.clean_image_cutout_fallback
    assert_equal "cleaned", imported_item.clean_image_variant
    assert_equal false, imported_item.clean_image_cutout_fallback
    assert_equal "Source Look", imported_outfit.name
    assert_equal imported_item.id, imported_outfit_item.clothing_item_id
    assert_equal 11.5, imported_outfit_item.collage_x
    assert_equal 6.0, imported_outfit_item.collage_rotation
    assert_not ClothingItem.exists?(name: "Stale target item")
    assert_not Outfit.exists?(name: "Stale target outfit")
    assert_equal target_user.email, summary[:target_email]
    assert_equal 1, summary.dig(:record_counts, :applied, "clothing_items")

    repeated_summary = AccountSnapshotApplier.new(
      target_email: target_user.email,
      snapshot_path: snapshot_path
    ).call

    target_user.reload
    assert_equal 1, target_user.clothing_items.count
    assert_equal 1, target_user.outfits.count
    assert_equal 1, target_user.outfit_uploads.count
    assert_equal 1, target_user.clothing_items.where(name: "Source Shirt").count
    assert_equal 1, repeated_summary.dig(:record_counts, :applied, "outfit_items")
  end

  test "preview rejects unsupported snapshot versions before mutation" do
    source_user, = create_source_account!
    snapshot_path = export_snapshot_for(source_user.email)
    target_user = create_target_user!(email: "bad-version-target@example.com")
    create_stale_target_data!(target_user)

    rewrite_snapshot(snapshot_path) do |manifest, _files|
      manifest["version"] = 999
    end

    error = assert_raises(AccountSnapshotManifest::ValidationError) do
      AccountSnapshotPreviewer.new(
        target_email: target_user.email,
        snapshot_path: snapshot_path
      ).call
    end

    assert_match(/Unsupported snapshot version/, error.message)
    assert_equal 1, target_user.clothing_items.count
    assert_equal 1, target_user.outfits.count
  end

  test "production apply requires the preview confirmation token" do
    source_user, = create_source_account!
    snapshot_path = export_snapshot_for(source_user.email)
    target_user = create_target_user!(email: "production-target@example.com")
    create_stale_target_data!(target_user)

    preview = AccountSnapshotPreviewer.new(
      target_email: target_user.email,
      snapshot_path: snapshot_path,
      target_environment: "production"
    ).call

    assert_raises(AccountSnapshotApplier::ConfirmationTokenError) do
      AccountSnapshotApplier.new(
        target_email: target_user.email,
        snapshot_path: snapshot_path,
        target_environment: "production"
      ).call
    end

    summary = AccountSnapshotApplier.new(
      target_email: target_user.email,
      snapshot_path: snapshot_path,
      target_environment: "production",
      confirmation_token: preview[:confirmation_token]
    ).call

    assert_equal 1, summary.dig(:record_counts, :applied, "clothing_items")
  end

  test "corrupted snapshot payloads fail before apply can replace target data" do
    source_user, = create_source_account!
    snapshot_path = export_snapshot_for(source_user.email)
    target_user = create_target_user!(email: "corrupt-target@example.com")
    create_stale_target_data!(target_user)

    rewrite_snapshot(snapshot_path) do |manifest, files|
      files.delete(manifest["attachments"].first.fetch("archive_path"))
    end

    error = assert_raises(AccountSnapshotManifest::ValidationError) do
      AccountSnapshotApplier.new(
        target_email: target_user.email,
        snapshot_path: snapshot_path
      ).call
    end

    assert_match(/missing attachment payloads/i, error.message)
    assert_equal 1, target_user.clothing_items.count
    assert_equal 1, target_user.outfits.count
    assert_equal 1, target_user.outfit_uploads.count
  end

  private

  def export_snapshot_for(email)
    snapshot_path = File.join(@tmp_dir, "#{SecureRandom.hex(6)}.tar.gz")
    AccountSnapshotExporter.new(email: email, output_path: snapshot_path).call
    snapshot_path
  end

  def rewrite_snapshot(snapshot_path)
    loaded_snapshot = AccountSnapshotArchive.load(path: snapshot_path)
    manifest = loaded_snapshot.manifest
    files = loaded_snapshot.files
    yield manifest, files
    AccountSnapshotArchive.write(manifest: manifest, attachment_payloads: files, path: snapshot_path)
  end

  def create_source_account!
    email = "mirror-source-#{SecureRandom.hex(4)}@example.com"
    user = create_user!(
      email: email,
      username: "source-#{SecureRandom.hex(3)}",
      provider: "google_oauth2",
      uid: "source-#{SecureRandom.hex(6)}",
      preferred_style: "source-style",
      avatar_url: "https://example.com/source.png",
      admin: false
    )

    upload = user.outfit_uploads.new(
      status: :succeeded,
      provider: "openrouter",
      vision_model: "vision-v1",
      error_message: nil,
      detected_at: Time.zone.parse("2026-05-20 10:00:00"),
      raw_response: { "items" => 1 }
    )
    upload.save!(validate: false)
    upload.source_photo.attach(
      io: StringIO.new("source-upload-photo"),
      filename: "upload.png",
      content_type: "image/png"
    )

    detection = upload.outfit_detections.new(
      category: "shirt",
      confidence: 0.94,
      suggested_name: "Source Shirt",
      details: { "dominant_color" => "navy" },
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
      crop_status: :verified,
      crop_attempts: 1,
      crop_confidence: 0.91,
      crop_notes: "verified",
      crop_quality_score: 0.86,
      clean_image_status: :succeeded,
      clean_image_error_message: nil,
      clean_image_provider: "openrouter",
      clean_image_model: "clean-v1",
      clean_image_generated_at: Time.zone.parse("2026-05-20 10:15:00"),
      clean_image_variant: "cleaned",
      clean_image_cutout_fallback: false
    )
    detection.save!(validate: false)
    detection.cleaned_photo.attach(
      io: StringIO.new("source-detection-cleaned"),
      filename: "detection.png",
      content_type: "image/png"
    )
    detection.cleaned_working_photo.attach(
      io: StringIO.new("source-detection-working"),
      filename: "detection-working.png",
      content_type: "image/png"
    )

    item = user.clothing_items.create!(
      name: "Source Shirt",
      category: "shirt",
      brand: "source brand",
      size: :medium,
      date: Time.zone.parse("2026-05-19 12:00:00"),
      tags: [ "capsule", "navy" ],
      source_outfit_upload_id: upload.id,
      source_outfit_detection_id: detection.id,
      clean_image_status: :succeeded,
      clean_image_error_message: nil,
      clean_image_provider: "openrouter",
      clean_image_model: "clean-v1",
      clean_image_generated_at: Time.zone.parse("2026-05-20 10:20:00"),
      clean_image_variant: "cleaned",
      clean_image_cutout_fallback: false
    )
    item.photo.attach(
      io: StringIO.new("source-item-photo"),
      filename: "item-photo.png",
      content_type: "image/png"
    )
    item.cleaned_photo.attach(
      io: StringIO.new("source-item-cleaned"),
      filename: "item-cleaned.png",
      content_type: "image/png"
    )
    item.cleaned_working_photo.attach(
      io: StringIO.new("source-item-working"),
      filename: "item-working.png",
      content_type: "image/png"
    )

    outfit = user.outfits.create!(
      name: "Source Look",
      tags: [ "office", "spring" ],
      notes: "Synced from source"
    )
    outfit_item = outfit.outfit_items.create!(
      clothing_item: item,
      layer_order: 2,
      collage_x: 11.5,
      collage_y: 22.25,
      collage_width: 44.0,
      collage_height: 55.0,
      collage_rotation: 6.0
    )

    timestamps = {
      upload: Time.zone.parse("2026-05-20 10:00:00"),
      detection: Time.zone.parse("2026-05-20 10:05:00"),
      item: Time.zone.parse("2026-05-20 10:10:00"),
      outfit: Time.zone.parse("2026-05-20 10:25:00"),
      outfit_item: Time.zone.parse("2026-05-20 10:30:00")
    }
    upload.update_columns(created_at: timestamps[:upload], updated_at: timestamps[:upload] + 5.minutes)
    detection.update_columns(created_at: timestamps[:detection], updated_at: timestamps[:detection] + 5.minutes)
    item.update_columns(created_at: timestamps[:item], updated_at: timestamps[:item] + 5.minutes)
    outfit.update_columns(created_at: timestamps[:outfit], updated_at: timestamps[:outfit] + 5.minutes)
    outfit_item.update_columns(created_at: timestamps[:outfit_item], updated_at: timestamps[:outfit_item] + 5.minutes)

    [
      user,
      {
        outfit_upload: upload,
        outfit_detection: detection,
        item: item,
        outfit: outfit,
        outfit_item: outfit_item
      }
    ]
  end

  def create_target_user!(email:, username: nil, provider: "google_oauth2", uid: nil, preferred_style: "target",
                          avatar_url: nil, admin: false)
    create_user!(
      email: email,
      username: username || "target-#{SecureRandom.hex(3)}",
      provider: provider,
      uid: uid || "target-#{SecureRandom.hex(6)}",
      preferred_style: preferred_style,
      avatar_url: avatar_url,
      admin: admin
    )
  end

  def create_user!(email:, username:, provider:, uid:, preferred_style:, avatar_url:, admin:)
    User.create!(
      email: email,
      username: username,
      provider: provider,
      uid: uid,
      preferred_style: preferred_style,
      avatar_url: avatar_url,
      admin: admin,
      password: "password123"
    )
  end

  def create_stale_target_data!(target_user)
    stale_item = target_user.clothing_items.create!(
      name: "Stale target item",
      category: "pants",
      size: :small,
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
      category: "pants",
      position: 0,
      crop_attempts: 0,
      crop_status: :pending,
      clean_image_status: :idle
    )
    stale_detection.save!(validate: false)
    stale_detection.cleaned_photo.attach(
      io: StringIO.new("stale-detection-photo"),
      filename: "stale-detection.png",
      content_type: "image/png"
    )

    stale_outfit = target_user.outfits.create!(
      name: "Stale target outfit",
      tags: [ "stale" ],
      notes: "To be replaced"
    )
    stale_outfit.outfit_items.create!(clothing_item: stale_item, layer_order: 0)
  end
end
