class OutfitTargetedRepair
  def self.call(brief:, candidate:, evaluation:, pools:, locked_ids:, excluded_ids:, user_id:)
    target_id = evaluation["repair_item_id"]
    return if target_id.blank? || locked_ids.include?(target_id) || evaluation["repair_instruction"].blank?
    target = candidate.fetch(:items).find { |item| item.id == target_id }
    return unless target
    role = OutfitStructure.roles(brief).find { |entry| OutfitStructure.matches?(target, entry) }
    return unless role
    query = OpenrouterWardrobeEmbedder.embed_query(evaluation["repair_instruction"])
    scorer = OutfitRecommendationScorer.new(brief: brief, query_embedding: query.fetch(:embedding))
    replacement = pools.fetch(role["role_id"], []).reject { |item| candidate[:items].map(&:id).include?(item.id) || excluded_ids.include?(item.id) || scorer.hard_violation?([ item ]) }
      .max_by { |item| scorer.item_score(item) }
    return unless replacement
    items = candidate[:items].map { |item| item.id == target_id ? replacement : item }
    return unless OutfitStructure.eligible?(items, brief: brief, user_id: user_id, locked_ids: locked_ids, excluded_ids: excluded_ids)
    { id: "repair-#{candidate.fetch(:id)}", items: items }
  end
end
