require "fileutils"
require "pathname"

class ClosetDataStandardizer
  DEFAULT_EMAIL = "annabelgoldman2025@u.northwestern.edu"

  Result = Struct.new(
    :apply,
    :email,
    :user_id,
    :before_counts,
    :after_counts,
    :audits,
    :duplicate_warnings,
    :backup_path,
    keyword_init: true
  )

  Audit = Struct.new(
    :id,
    :old_category,
    :new_category,
    :old_brand,
    :new_brand,
    :old_name,
    :new_name,
    :old_tags,
    :new_tags,
    keyword_init: true
  ) do
    def changed?
      old_category != new_category ||
        old_brand != new_brand ||
        old_name != new_name ||
        old_tags != new_tags
    end
  end

  def initialize(email: DEFAULT_EMAIL, apply: false, output: nil)
    @email = email.to_s.strip
    @apply = ActiveModel::Type::Boolean.new.cast(apply)
    @output = output
  end

  def call
    raise ArgumentError, "Provide a user email." if email.blank?
    raise ArgumentError, "Closet data standardization is only available in development and test." unless Rails.env.development? || Rails.env.test?

    user = User.where("lower(email) = ?", email.downcase).first
    raise ActiveRecord::RecordNotFound, "No user found for #{email}." unless user

    before_counts = category_counts(user)
    audits = user.clothing_items.order(:id).map { |item| audit_for(item) }
    duplicate_warnings = duplicate_name_warnings(user)

    backup_path = nil

    if apply?
      backup_path = create_database_backup!

      ClothingItem.transaction do
        audits.select(&:changed?).each do |audit|
          item = user.clothing_items.find(audit.id)
          item.update!(
            category: audit.new_category,
            brand: audit.new_brand,
            name: audit.new_name,
            tags: audit.new_tags
          )
        end
      end
    end

    result = Result.new(
      apply: apply?,
      email: user.email,
      user_id: user.id,
      before_counts: before_counts,
      after_counts: apply? ? category_counts(user.reload) : simulated_category_counts(audits),
      audits: audits,
      duplicate_warnings: duplicate_warnings,
      backup_path: backup_path
    )

    print_result(result) if output
    result
  end

  private

  attr_reader :email, :output

  def apply?
    @apply
  end

  def audit_for(item)
    new_category = WardrobeTaxonomy.normalize_category(item.category, name: item.name)
    new_name = WardrobeTaxonomy.normalize_item_name(item.name)
    extra_subtype = WardrobeTaxonomy.subtype_tag_for_category(item.category, canonical_category: new_category)
    inferred_subtype = WardrobeTaxonomy.infer_subtype_from_name_for_category(new_name, new_category)

    Audit.new(
      id: item.id,
      old_category: item.category,
      new_category: new_category,
      old_brand: item.brand,
      new_brand: WardrobeTaxonomy.normalize_brand(item.brand),
      old_name: item.name,
      new_name: new_name,
      old_tags: TagListNormalizer.call(item.tags),
      new_tags: WardrobeTaxonomy.normalize_tags(
        item.tags,
        category: new_category,
        extra_tags: [ extra_subtype, inferred_subtype ].compact
      )
    )
  end

  def category_counts(user)
    user
      .clothing_items
      .group(:category)
      .count
      .transform_keys { |category| category.presence || "(blank)" }
      .sort
      .to_h
  end

  def simulated_category_counts(audits)
    audits
      .group_by { |audit| audit.new_category.presence || "(blank)" }
      .transform_values(&:length)
      .sort
      .to_h
  end

  def duplicate_name_warnings(user)
    user
      .clothing_items
      .order(:id)
      .group_by { |item| item.name.to_s.strip.downcase }
      .filter_map do |name, items|
        next if name.blank? || items.length < 2

        {
          name: name,
          item_ids: items.map(&:id),
          display_names: items.map(&:name).uniq
        }
      end
  end

  def print_result(result)
    output.puts "Closet data standardization for #{result.email} (user ##{result.user_id})"
    output.puts "Mode: #{result.apply ? 'APPLY' : 'DRY RUN'}"
    output.puts "Backup: #{result.backup_path}" if result.backup_path.present?
    output.puts
    output.puts "Category counts before:"
    print_counts(result.before_counts)
    output.puts
    output.puts "Category counts after:"
    print_counts(result.after_counts)
    output.puts
    output.puts "Changed items:"

    changed_audits = result.audits.select(&:changed?)
    if changed_audits.empty?
      output.puts "  none"
    else
      changed_audits.each do |audit|
        output.puts "  ##{audit.id}"
        output.puts "    category: #{audit.old_category.inspect} -> #{audit.new_category.inspect}" if audit.old_category != audit.new_category
        output.puts "    brand: #{audit.old_brand.inspect} -> #{audit.new_brand.inspect}" if audit.old_brand != audit.new_brand
        output.puts "    name: #{audit.old_name.inspect} -> #{audit.new_name.inspect}" if audit.old_name != audit.new_name
        output.puts "    tags: #{audit.old_tags.inspect} -> #{audit.new_tags.inspect}" if audit.old_tags != audit.new_tags
      end
    end

    output.puts
    output.puts "Duplicate-looking names:"
    if result.duplicate_warnings.empty?
      output.puts "  none"
    else
      result.duplicate_warnings.each do |warning|
        output.puts "  #{warning[:display_names].join(' / ')}: #{warning[:item_ids].join(', ')}"
      end
    end
  end

  def print_counts(counts)
    counts.each do |category, count|
      output.puts "  #{category}: #{count}"
    end
  end

  def create_database_backup!
    return unless ActiveRecord::Base.connection.adapter_name.downcase.include?("sqlite")

    database_path = Pathname.new(ActiveRecord::Base.connection_db_config.database)
    database_path = Rails.root.join(database_path) unless database_path.absolute?
    return unless database_path.exist?

    backup_dir = Rails.root.join("tmp/closet_data_backups")
    FileUtils.mkdir_p(backup_dir)

    timestamp = Time.zone.now.strftime("%Y%m%d-%H%M%S")
    backup_path = backup_dir.join("#{Rails.env}-before-closet-standardization-#{timestamp}.sqlite3")
    FileUtils.cp(database_path, backup_path)
    backup_path.to_s
  end
end
