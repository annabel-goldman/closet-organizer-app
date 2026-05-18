module InputLengthPolicy
  MAX_USERNAME = 60
  MAX_EMAIL = 254
  MAX_PREFERRED_STYLE = 40

  MAX_CLOTHING_ITEM_NAME = 120
  MAX_CLOTHING_ITEM_BRAND = 80
  MAX_CLOTHING_ITEM_CATEGORY = 60

  MAX_OUTFIT_NAME = 120
  MAX_OUTFIT_NOTES = 2_000

  MAX_TAG_LENGTH = 40
  MAX_TAGS_PER_RECORD = 30

  module_function

  def validate_tag_list(record, attribute, tags)
    return if tags.blank?
    return unless tags.is_a?(Array)

    if tags.length > MAX_TAGS_PER_RECORD
      record.errors.add(attribute, "must have #{MAX_TAGS_PER_RECORD} or fewer entries")
      return
    end

    if tags.any? { |tag| tag.to_s.length > MAX_TAG_LENGTH }
      record.errors.add(attribute, "must each be #{MAX_TAG_LENGTH} characters or fewer")
    end
  end
end
