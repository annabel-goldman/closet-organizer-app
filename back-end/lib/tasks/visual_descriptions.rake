namespace :clothing_items do
  desc "Regenerate clothing item visual descriptions using AI metadata suggestions"
  task regenerate_visual_descriptions: :environment do
    load_local_env_file

    scope = ClothingItem
      .with_attached_photo
      .with_attached_cleaned_photo
      .order(:id)
    scope = scope.where(user_id: ENV["USER_ID"]) if ENV["USER_ID"].present?
    scope = scope.joins(:user).where(users: { email: ENV["USER_EMAIL"] }) if ENV["USER_EMAIL"].present?
    scope = scope.where("clothing_items.id >= ?", ENV["START_ID"].to_i) if ENV["START_ID"].present?
    scope = scope.where("clothing_items.id <= ?", ENV["END_ID"].to_i) if ENV["END_ID"].present?
    scope = scope.where(style_notes: [ nil, "" ]) unless ActiveModel::Type::Boolean.new.cast(ENV.fetch("OVERWRITE", "true"))

    limit = ENV["LIMIT"].presence&.to_i
    scope = scope.limit(limit) if limit&.positive?

    dry_run = ActiveModel::Type::Boolean.new.cast(ENV["DRY_RUN"])
    processed = 0
    updated = 0
    skipped = 0
    failed = 0
    stopped_early = false

    puts "Regenerating visual descriptions for #{scope.count} clothing item#{scope.count == 1 ? '' : 's'}#{dry_run ? ' (dry run)' : ''}..."

    scope.find_each do |item|
      processed += 1

      unless item.source_photo_for_cleaning.attached?
        skipped += 1
        puts "Skipping ##{item.id} #{item.name.inspect}: no photo"
        next
      end

      suggestion = OpenrouterMetadataSuggester.call(
        item.source_photo_for_cleaning,
        metadata_context: clothing_item_metadata_context(item)
      )
      visual_description = suggestion[:style_notes].to_s.squish

      if visual_description.blank?
        skipped += 1
        puts "Skipping ##{item.id} #{item.name.inspect}: AI returned a blank visual description"
        next
      end

      if dry_run
        updated += 1
        puts "Would update ##{item.id} #{item.name.inspect}: #{visual_description}"
        next
      end

      item.update!(style_notes: visual_description)
      updated += 1
      puts "Updated ##{item.id} #{item.name.inspect}"
    rescue StandardError => error
      failed += 1
      puts "Failed ##{item.id} #{item.name.inspect}: #{error.message}"
      if insufficient_credit_error?(error)
        stopped_early = true
        puts "Stopping early because OpenRouter reported insufficient credits. Add credits, then rerun with START_ID=#{item.id}."
        break
      end
    end

    puts "Done#{stopped_early ? ' (stopped early)' : ''}. Processed: #{processed}, updated: #{updated}, skipped: #{skipped}, failed: #{failed}."
  end
end

def load_local_env_file
  env_path = Rails.root.join(".env")
  return unless env_path.file?

  env_path.each_line do |line|
    next if line.strip.blank? || line.match?(/\A\s*#/)

    key, value = line.split("=", 2)
    next if key.blank? || value.nil?

    key = key.sub(/\Aexport\s+/, "").strip
    next unless key.match?(/\A[A-Za-z_][A-Za-z0-9_]*\z/)

    ENV[key] ||= value.strip.delete_prefix('"').delete_suffix('"').delete_prefix("'").delete_suffix("'")
  end
end

def clothing_item_metadata_context(item)
  {
    category: item.category,
    name: item.name,
    brand: item.brand,
    size: item.size,
    date: item.date&.to_date&.iso8601,
    tags: TagListNormalizer.call(item.tags)
  }.compact_blank
end

def insufficient_credit_error?(error)
  message = error.message.to_s.downcase
  message.include?("insufficient credits") || message.include?("requires more credits")
end
