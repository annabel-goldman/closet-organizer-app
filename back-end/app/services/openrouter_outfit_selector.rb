require "base64"

# Experimental alternative assembler. Receives the exact same role pools as the
# contextual beam search. IDs are checked against each role, not trusted from AI.
class OpenrouterOutfitSelector
  def self.call(brief:, pools:, locked_items:, count: 6)
    sheets = []
    roles = OutfitStructure.roles(brief)
    content = [ { type: "text", text: "Select up to #{count.clamp(1, 6)} distinct clothing combinations. Plan: #{brief.to_json}. Locked IDs: #{locked_items.map(&:id).to_json}. Use only listed IDs and retain locked pieces. Prefer the suggested anchor and clothing coverage, but incomplete outfits are allowed. Inferred props and accessories are optional: omit them rather than substitute unrelated items. Each role's contact sheet is row-major. Return JSON {outfits: [{item_ids: [integer]}]}." } ]
    pools.each do |role_id, items|
      next if items.empty?
      sheet = OutfitCandidateCollageRenderer.call(items)
      sheets << sheet
      content << { type: "text", text: "#{roles.find { |role| role['role_id'] == role_id }.to_json}; row-major items: #{items.map { |item| { id: item.id, name: item.name } }.to_json}" }
      content << { type: "image_url", image_url: { url: "data:image/png;base64,#{Base64.strict_encode64(File.binread(sheet.path))}" } }
    end
    response = OpenrouterClient.new(api_key: ENV.fetch("OPENROUTER_API_KEY"), base_url: ENV.fetch("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"), read_timeout: 180).post_json(
      path: "/chat/completions", body: {
        model: "google/gemini-2.5-flash", max_tokens: 1800, temperature: 0.2,
        response_format: { type: "json_schema", json_schema: { name: "outfit_selection", strict: true, schema: {
          type: "object", additionalProperties: false, required: [ "outfits" ], properties: {
            outfits: { type: "array", minItems: 1, maxItems: count.clamp(1, 6), items: {
              type: "object", additionalProperties: false, required: [ "item_ids" ], properties: {
                item_ids: { type: "array", minItems: 1, maxItems: 16, items: { type: "integer" } }
              }
            } }
          }
        } } }, messages: [ { role: "user", content: content } ]
      }
    )
    payload = JSON.parse(response.dig("choices", 0, "message", "content").to_s)
    available = (pools.values.flatten + locked_items).uniq(&:id).index_by(&:id)
    Array(payload["outfits"]).first(count).filter_map do |outfit|
      ids = outfit["item_ids"]
      next unless ids.is_a?(Array) && ids.all? { |id| available.key?(id) }
      items = ids.map { |id| available.fetch(id) }
      next unless OutfitStructure.eligible?(items, brief: brief, locked_ids: locked_items.map(&:id))
      items
    end
  ensure
    Array(sheets).each(&:close!)
  end
end
