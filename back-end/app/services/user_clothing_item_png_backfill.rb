class UserClothingItemPngBackfill
  Error = Class.new(StandardError)
  UserNotFoundError = Class.new(Error)

  def initialize(email:, force: false, item_ids: nil)
    @email = email.to_s.strip
    @force = ActiveModel::Type::Boolean.new.cast(force)
    @item_ids = Array(item_ids).filter_map { |value| Integer(value, exception: false) }.uniq
  end

  def call
    raise UserNotFoundError, "Provide a user email." if email.blank?

    user = User.where("lower(email) = ?", email.downcase).first
    raise UserNotFoundError, "No user found for #{email}." unless user

    items = scoped_items_for(user)
      .with_attached_photo
      .with_attached_cleaned_photo
      .order(:id)

    summary = {
      email: user.email,
      user_id: user.id,
      force: force,
      total_items: items.size,
      processed: 0,
      skipped_already_cleaned: 0,
      skipped_without_source_photo: 0,
      failed: 0,
      failures: []
    }

    items.each do |item|
      unless item.photo.attached?
        summary[:skipped_without_source_photo] += 1
        next
      end

      if item.cleaned_photo.attached? && !force
        summary[:skipped_already_cleaned] += 1
        next
      end

      reset_clean_image_state!(item) if force

      CleanImageAttachmentGenerator.call(
        record: item,
        source_photo: item.photo,
        prompt_context: ImageCleanPromptBuilder.for_clothing_item(item),
        reference_photos: reference_photos_for(item),
        metadata_context: metadata_context_for(item)
      )

      summary[:processed] += 1
    rescue StandardError => error
      summary[:failed] += 1
      summary[:failures] << {
        item_id: item.id,
        item_name: item.name,
        error: error.message
      }
    end

    summary
  end

  private

  attr_reader :email, :force, :item_ids

  def scoped_items_for(user)
    items = user.clothing_items
    return items if item_ids.blank?

    items.where(id: item_ids)
  end

  def metadata_context_for(item)
    {
      category: item.category,
      name: item.name,
      brand: item.brand,
      size: item.size,
      date: item.date&.to_date&.iso8601,
      tags: TagListNormalizer.call(item.tags)
    }.compact_blank
  end

  def reference_photos_for(item)
    source_upload = OutfitUpload.find_by(id: item.source_outfit_upload_id, user_id: item.user_id)
    return [] unless source_upload&.source_photo&.attached?

    [ source_upload.source_photo ]
  end

  def reset_clean_image_state!(item)
    item.update!(
      clean_image_status: :idle,
      clean_image_error_message: nil,
      clean_image_provider: nil,
      clean_image_model: nil,
      clean_image_generated_at: nil,
      clean_image_variant: nil,
      clean_image_cutout_fallback: false
    )
  end
end
