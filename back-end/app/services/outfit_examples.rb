require "digest"

class OutfitExamples
  EXPERIMENT_NAME = "single-look-v1".freeze

  def self.experiment(user)
    OutfitExperiment.find_or_create_by!(user: user, name: EXPERIMENT_NAME) do |experiment|
      outfits = user.outfits.includes(:clothing_items).order(:id).to_a
      # Connected components keep >=75%-overlap near duplicates in one split.
      groups = []
      outfits.each do |outfit|
        ids = outfit.clothing_items.map(&:id)
        matches = groups.select { |group| group.any? { |other| near_duplicate?(ids, other.clothing_items.map(&:id)) } }
        groups -= matches
        groups << (matches.flatten + [ outfit ])
      end
      # Category diversity first; deterministic IDs break ties. Never split a group to hit exactly six.
      ordered = groups.sort_by { |group| Digest::SHA256.hexdigest(group.map(&:id).join(":")) }
      held = []
      seen = []
      ordered.sort_by { |group| [ group.first.clothing_items.map(&:category).sort.join(":"), group.first.id ] }.each do |group|
        signature = group.first.clothing_items.map(&:category).sort.uniq
        next if seen.include?(signature) || held.length + group.length > 6
        held.concat(group.map(&:id))
        seen << signature
      end
      ordered.each { |group| held.concat(group.map(&:id)) if (held & group.map(&:id)).empty? && held.length + group.length <= 6 }
      experiment.manifest = { "example_outfit_ids" => outfits.map(&:id) - held, "held_out_outfit_ids" => held, "status" => "experimental", "created_from_outfit_count" => outfits.length }
    end
  end

  def self.near_duplicate?(left, right)
    left.any? && (left & right).length.to_f / [ left.length, right.length, 1 ].max >= 0.75
  end

  def self.call(user, query:, limit: 3)
    manifest = experiment(user).manifest
    allowed = manifest.fetch("example_outfit_ids")
    # Exclude new outfits that duplicate any held-out combination, too.
    held = user.outfits.where(id: manifest.fetch("held_out_outfit_ids")).includes(:clothing_items).map { |outfit| outfit.clothing_items.map(&:id) }
    descriptions = user.outfits.where(id: allowed).includes(:clothing_items).filter_map do |outfit|
      next if held.any? { |ids| near_duplicate?(ids, outfit.clothing_items.map(&:id)) }
      description(outfit)
    end
    terms = query.to_s.downcase.scan(/[a-z]+/).uniq
    descriptions.sort_by { |entry| [ -(terms & entry.to_json.downcase.scan(/[a-z]+/)).length, entry.fetch("outfit_id") ] }.first(limit.clamp(0, 3))
  end

  def self.description(outfit)
    items = outfit.clothing_items.order(:id).map do |item|
      { id: item.id, name: item.name, category: item.category, attributes: item.wardrobe_item_analysis&.extracted_attributes }
    end
    data = { "outfit_id" => outfit.id, "title" => outfit.name, "items" => items }
    fingerprint = Digest::SHA256.hexdigest(data.to_json)
    cache = OutfitExampleDescription.find_or_initialize_by(outfit: outfit)
    cache.update!(fingerprint: fingerprint, description: data) if cache.fingerprint != fingerprint
    cache.description
  end
end
