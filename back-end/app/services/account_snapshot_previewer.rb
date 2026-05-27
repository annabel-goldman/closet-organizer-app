class AccountSnapshotPreviewer
  Error = Class.new(StandardError)

  def initialize(target_email:, snapshot_path: nil, snapshot_io: nil, target_environment: Rails.env)
    @target_email = target_email.to_s.strip
    @snapshot_path = snapshot_path.to_s.strip.presence
    @snapshot_io = snapshot_io
    @target_environment = target_environment.to_s
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
    target_counts = record_counts_for(target_user)

    summary = {
      source_email: manifest["user_email"],
      target_email: target_email,
      target_user_exists: target_user.present?,
      target_user_id: target_user&.id,
      source_environment: manifest.fetch("source"),
      target_environment: target_environment,
      snapshot_version: manifest["version"],
      attachment_count: Array(manifest["attachments"]).size,
      record_counts: {
        snapshot: manifest.fetch("record_counts"),
        target: target_counts,
        will_create: manifest.fetch("record_counts"),
        will_delete: target_counts
      },
      requires_confirmation: AccountSnapshotManifest.requires_confirmation?(target_environment)
    }

    if summary[:requires_confirmation]
      summary[:confirmation_token] = AccountSnapshotManifest.confirmation_token(
        manifest: manifest,
        target_email: target_email,
        target_environment: target_environment
      )
    end

    summary
  end

  private

  attr_reader :target_email, :snapshot_path, :snapshot_io, :target_environment

  def record_counts_for(target_user)
    return empty_counts unless target_user

    outfit_upload_ids = target_user.outfit_uploads.pluck(:id)

    {
      "clothing_items" => target_user.clothing_items.count,
      "outfits" => target_user.outfits.count,
      "outfit_items" => OutfitItem.joins(:outfit).where(outfits: { user_id: target_user.id }).count,
      "outfit_uploads" => target_user.outfit_uploads.count,
      "outfit_detections" => OutfitDetection.where(outfit_upload_id: outfit_upload_ids).count
    }
  end

  def empty_counts
    AccountSnapshotManifest::RECORD_DEFINITIONS.keys.index_with { 0 }
  end
end
