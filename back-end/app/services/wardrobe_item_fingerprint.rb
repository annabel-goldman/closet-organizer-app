require "digest"

class WardrobeItemFingerprint
  def self.call(item)
    new(item).call
  end

  def initialize(item)
    @item = item
  end

  def call
    attachment = item.display_photo_attachment
    {
      source: attachment.attached? ? attachment.blob.checksum : nil,
      metadata: Digest::SHA256.hexdigest(metadata_payload.to_json)
    }
  end

  private

  attr_reader :item

  def metadata_payload
    {
      name: item.name.to_s.squish,
      category: item.category.to_s.squish,
      brand: item.brand.to_s.squish,
      size: item.size,
      tags: TagListNormalizer.call(item.tags),
      style_notes: item.style_notes.to_s.squish
    }
  end
end
