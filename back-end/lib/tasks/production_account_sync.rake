namespace :data do
  desc "Legacy: copy one production account and its owned data into the local database"
  task :sync_production_account, [ :source_email, :target_email ] => :environment do |_task, args|
    source_email = args[:source_email].presence || ENV["PRODUCTION_ACCOUNT_EMAIL"]
    target_email = args[:target_email].presence || ENV["LOCAL_ACCOUNT_EMAIL"]
    storage_service_name = ENV["SYNC_ACCOUNT_STORAGE_SERVICE"]

    summary = ProductionAccountSyncer.new(
      source_email: source_email,
      target_email: target_email,
      source_database_url: ENV["PRODUCTION_DATABASE_URL"],
      storage_service_name: storage_service_name
    ).call

    puts "Synced production account #{summary[:source_email]} into local user ##{summary[:user_id]} (#{summary[:target_email]})."
    puts "Imported #{summary[:clothing_items]} clothing items, #{summary[:outfits]} outfits, #{summary[:outfit_uploads]} outfit uploads, and #{summary[:outfit_detections]} outfit detections."
    puts "Stored copied attachments in Active Storage service #{summary[:storage_service]}."
  end
end
