namespace :data do
  desc "Backfill cleaned PNGs for one user's clothing item photos"
  task :backfill_user_clothing_item_pngs, [ :email ] => :environment do |_task, args|
    email = args[:email].presence || ENV["ACCOUNT_EMAIL"]
    raise ArgumentError, "Provide an email via rake arg or ACCOUNT_EMAIL." if email.blank?

    summary = UserClothingItemPngBackfill.new(
      email: email,
      force: ENV["FORCE"]
    ).call

    puts "Backfilled cleaned PNGs for user ##{summary[:user_id]} (#{summary[:email]})."
    puts "Processed #{summary[:processed]} item(s)."
    puts "Skipped #{summary[:skipped_already_cleaned]} already-cleaned item(s)."
    puts "Skipped #{summary[:skipped_without_source_photo]} item(s) without a source photo."

    next if summary[:failed].zero?

    puts "Failed #{summary[:failed]} item(s):"
    summary[:failures].each do |failure|
      puts "- item ##{failure[:item_id]} (#{failure[:item_name]}): #{failure[:error]}"
    end

    abort "PNG backfill finished with failures."
  end
end
