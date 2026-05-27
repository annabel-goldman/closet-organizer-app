namespace :data do
  desc "Legacy: import missing production clothing items for one local user and backfill cleaned PNGs for the imported items"
  task :import_missing_production_items_and_backfill_pngs, [ :source_email, :target_email ] => :environment do |_task, args|
    source_email = args[:source_email].presence || ENV["PRODUCTION_ACCOUNT_EMAIL"]
    target_email = args[:target_email].presence || ENV["LOCAL_ACCOUNT_EMAIL"] || source_email
    storage_service_name = ENV["SYNC_ACCOUNT_STORAGE_SERVICE"]

    import_summary = MissingProductionClothingItemImporter.new(
      source_email: source_email,
      target_email: target_email,
      source_database_url: ENV["PRODUCTION_DATABASE_URL"],
      storage_service_name: storage_service_name
    ).call

    puts "Imported #{import_summary[:imported]} missing production item(s) into local user ##{import_summary[:user_id]} (#{import_summary[:target_email]})."
    puts "Skipped #{import_summary[:skipped_existing]} source item(s) that already exist locally and #{import_summary[:skipped_without_source_photo]} item(s) without a source photo."

    if import_summary[:imported_item_ids].empty?
      puts "No new items needed PNG backfill."
      next
    end

    png_summary = UserClothingItemPngBackfill.new(
      email: import_summary[:target_email],
      item_ids: import_summary[:imported_item_ids],
      force: ENV["FORCE"]
    ).call

    puts "PNG backfill processed #{png_summary[:processed]} imported item(s)."
    puts "Skipped #{png_summary[:skipped_already_cleaned]} already-cleaned imported item(s) and #{png_summary[:skipped_without_source_photo]} imported item(s) without a source photo."

    next if png_summary[:failed].zero?

    puts "Failed #{png_summary[:failed]} imported item(s):"
    png_summary[:failures].each do |failure|
      puts "- item ##{failure[:item_id]} (#{failure[:item_name]}): #{failure[:error]}"
    end

    abort "Incremental production import finished with PNG backfill failures."
  end
end
