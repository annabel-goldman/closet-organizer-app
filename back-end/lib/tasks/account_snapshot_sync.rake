namespace :data do
  desc "Export one user's full owned content and image attachments into a snapshot archive"
  task :export_account_snapshot, [ :email ] => :environment do |_task, args|
    email = args[:email].presence || ENV["ACCOUNT_SNAPSHOT_EMAIL"]
    snapshot_path = ENV["ACCOUNT_SNAPSHOT_PATH"]

    summary = AccountSnapshotExporter.new(
      email: email,
      output_path: snapshot_path,
      output_io: snapshot_path.present? ? nil : $stdout
    ).call

    $stderr.puts "Exported snapshot for #{summary[:email]}."
    $stderr.puts "Serialized #{summary[:attachment_count]} attachment payloads across #{summary[:record_counts].values.sum} owned records."
    $stderr.puts "Wrote archive to #{summary[:output_path]}." if summary[:output_path].present?
  rescue StandardError => error
    abort(error.message)
  end

  desc "Preview a hard-replace account snapshot apply for one target user"
  task :preview_account_snapshot, [ :target_email ] => :environment do |_task, args|
    target_email = args[:target_email].presence || ENV["ACCOUNT_SNAPSHOT_TARGET_EMAIL"]
    snapshot_path = ENV["ACCOUNT_SNAPSHOT_PATH"]

    summary = AccountSnapshotPreviewer.new(
      target_email: target_email,
      snapshot_path: snapshot_path,
      snapshot_io: snapshot_path.present? ? nil : $stdin
    ).call

    puts "Snapshot source: #{summary[:source_email]} (#{summary.dig(:source_environment, 'rails_env')})"
    puts "Target user: #{summary[:target_email]}"
    puts "Target exists: #{summary[:target_user_exists]}"
    puts "Attachment payloads: #{summary[:attachment_count]}"
    puts "Snapshot counts: #{summary.dig(:record_counts, :snapshot)}"
    puts "Target counts: #{summary.dig(:record_counts, :target)}"
    puts "Will delete: #{summary.dig(:record_counts, :will_delete)}"
    puts "Will create: #{summary.dig(:record_counts, :will_create)}"
    if summary[:requires_confirmation]
      puts "Confirmation token: #{summary[:confirmation_token]}"
    end
  rescue StandardError => error
    abort(error.message)
  end

  desc "Apply a hard-replace account snapshot for one target user"
  task :apply_account_snapshot, [ :target_email, :confirmation_token ] => :environment do |_task, args|
    target_email = args[:target_email].presence || ENV["ACCOUNT_SNAPSHOT_TARGET_EMAIL"]
    confirmation_token = args[:confirmation_token].presence || ENV["ACCOUNT_SNAPSHOT_CONFIRMATION_TOKEN"]
    snapshot_path = ENV["ACCOUNT_SNAPSHOT_PATH"]

    summary = AccountSnapshotApplier.new(
      target_email: target_email,
      confirmation_token: confirmation_token,
      snapshot_path: snapshot_path,
      snapshot_io: snapshot_path.present? ? nil : $stdin,
      storage_service_name: ENV["ACCOUNT_SNAPSHOT_STORAGE_SERVICE"]
    ).call

    puts "Applied snapshot from #{summary[:source_email]} to #{summary[:target_email]}."
    puts "Deleted counts: #{summary.dig(:record_counts, :deleted)}"
    puts "Applied counts: #{summary.dig(:record_counts, :applied)}"
    puts "Copied #{summary[:attachment_count]} attachment payloads into storage service #{summary[:storage_service]}."
  rescue StandardError => error
    abort(error.message)
  end
end
