class OutfitExperimentReview
  DIMENSIONS = %w[completeness request_accuracy wearability].freeze

  def self.import!(experiment, ratings)
    manifest = experiment.manifest.deep_dup
    Array(ratings).each do |rating|
      trial = manifest.fetch("trials", {}).fetch(rating.fetch("prompt_id"))
      result = trial.fetch("results").values.find { |value| value["blind_label"] == rating.fetch("label") }
      raise ArgumentError, "Unknown blind look label" unless result
      unless DIMENSIONS.all? { |key| rating[key].is_a?(Integer) && (1..5).cover?(rating[key]) } && [ true, false ].include?(rating["explicit_constraint_failure"])
        raise ArgumentError, "Every look needs three integer ratings (1–5) and an explicit-constraint failure true/false."
      end
      result["ratings"] = rating.slice(*DIMENSIONS, "explicit_constraint_failure")
    end
    experiment.update!(manifest: manifest)
    assess(experiment)
  end

  def self.assess(experiment)
    trials = experiment.manifest.fetch("trials", {}).values
    held = trials.select { |trial| trial["split"] == "held_out" }
    methods = OutfitExperimentRunner::METHODS
    complete = trials.length == 30 && held.length == 10 && trials.all? { |trial| methods.all? { |method| trial.dig("results", method, "ratings").present? } }
    return { status: "experimental", reason: "All thirty prompts, including ten held-out prompts, require blind human ratings for all three methods." } unless complete

    scores = methods.to_h do |method|
      results = held.map { |trial| trial.fetch("results").fetch(method) }
      mean = results.sum { |result| DIMENSIONS.sum { |key| result.fetch("ratings").fetch(key) } }.to_f / (results.length * DIMENSIONS.length)
      [ method, { score: mean, cost: results.sum { |result| result["reserved_usd"].to_f }, latency: results.sum { |result| result["latency_ms"].to_i } } ]
    end
    safe = %w[contextual visual].select do |method|
      trials.all? do |trial|
        result = trial.dig("results", method)
        result && result["structurally_valid"] && !result.dig("ratings", "explicit_constraint_failure")
      end
    end
    winner = safe.sort_by { |method| [ -scores[method][:score], scores[method][:cost], scores[method][:latency] ] }.first
    return { status: "experimental", scores: scores, reason: "No safe method improved on the baseline." } unless winner && scores[winner][:score] > scores["baseline"][:score]

    { status: "eligible_for_promotion", method: winner, scores: scores }
  end
end
