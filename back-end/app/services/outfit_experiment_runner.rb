require "digest"
require "json"

# Deliberately sequential. Shared pools and the split are persisted before judging,
# so resumed comparisons neither resample the closet nor rerun completed provider calls.
class OutfitExperimentRunner
  METHODS = %w[baseline contextual visual].freeze

  def initialize(user)
    @user = user
    @experiment = OutfitExamples.experiment(user)
  end

  def call(limit: 1, split: "development")
    prompts = JSON.parse(File.read(Rails.root.join("config/outfit_evaluation_prompts.json")))
    prompts.select { |entry| entry.fetch("split") == split }.first(limit.clamp(1, 30)).each do |entry|
      OutfitProviderBudget.with(experiment: @experiment) { evaluate(entry) }
    end
    report
  rescue OutfitProviderBudget::LimitExceeded => error
    persist("budget_stop" => error.message)
    report
  end

  def report
    @experiment.reload
    { experiment_id: @experiment.id, reserved_usd: @experiment.reserved_usd.to_f,
      attempts: @experiment.outfit_provider_attempts.count, manifest: @experiment.manifest }
  end

  private

  def evaluate(entry)
    trials = @experiment.reload.manifest.fetch("trials", {})
    trial = trials[entry.fetch("id")] || { "prompt" => entry.fetch("prompt"), "split" => entry.fetch("split"), "results" => {} }
    held = @experiment.manifest.fetch("held_out_outfit_ids")
    profile = OutfitPreferenceProfileBuilder.call(@user, excluded_outfit_ids: held, refresh: true)
    locked = entry["lock_category"] ? @user.clothing_items.where(category: entry["lock_category"]).order(:id).limit(1).pluck(:id) : []
    trial["locked_item_ids"] ||= locked
    unless trial["brief"]
      trial["brief"] = OpenrouterOutfitBriefParser.call(entry.fetch("prompt"), locked_items: @user.clothing_items.where(id: locked))
      trial["brief"]["examples"] = OutfitExamples.call(@user, query: entry.fetch("prompt"))
      save_trial(entry, trial)
    end
    unless trial["pools"]
      built = OutfitRecommendationBuilder.call(user: @user, prompt: entry.fetch("prompt"), brief: trial["brief"], locked_item_ids: locked, shortlist_count: 5, preference_profile: profile)
      trial["brief"] = built.fetch(:brief)
      trial["pools"] = built.fetch(:pools).transform_values { |items| items.map(&:id) }
      trial["contextual_candidates"] = built.fetch(:recommendations).map { |candidate| { "id" => candidate[:id], "item_ids" => candidate[:item_ids] } }
      save_trial(entry, trial)
    end
    METHODS.each do |method|
      next if trial["results"][method] && !trial["results"][method]["error"]
      started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      before = @experiment.reload.reserved_usd
      begin
        candidates = candidates_for(method, trial, profile)
        judge = method == "baseline" ? OutfitBaselineVisualJudge : OpenrouterOutfitVisualJudge
        judgment = judge.call(brief: trial["brief"], candidates: candidates)
        judgment = repair_judgment(entry, method, trial, candidates, judgment) unless method == "baseline"
        winner = judgment.fetch(:passing).first
        items = winner && candidates.find { |candidate| candidate[:id] == winner["candidate_id"] }&.fetch(:items)
        valid = items.present? && OutfitStructure.eligible?(items, brief: trial["brief"], user_id: @user.id, locked_ids: locked)
        trial["results"][method] = { "item_ids" => items&.map(&:id) || [], "structurally_valid" => !!valid, "complete" => items.present? && OutfitStructure.covered?(items), "judgment" => winner,
          "blind_label" => Digest::SHA256.hexdigest("#{@experiment.id}:#{entry['id']}:#{method}").first(8),
          "ratings" => nil, "reserved_usd" => (@experiment.reload.reserved_usd - before).to_f,
          "latency_ms" => ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - started) * 1000).round }
      rescue OutfitProviderBudget::LimitExceeded
        raise
      rescue StandardError => error
        trial["results"][method] = { "error" => error.message, "structurally_valid" => false }
      ensure
        save_trial(entry, trial)
      end
    end
  end

  def candidates_for(method, trial, profile)
    key = "#{method}_candidates"
    unless trial[key]
      pools = trial.fetch("pools").transform_values { |ids| @user.clothing_items.where(id: ids).includes(:wardrobe_item_analysis).to_a }
      locked = @user.clothing_items.where(id: trial.fetch("locked_item_ids")).to_a
      if method == "visual"
        selected = OpenrouterOutfitSelector.call(brief: trial["brief"], pools: pools, locked_items: locked, count: 5)
        trial[key] = selected.map { |items| { "id" => Digest::SHA256.hexdigest(items.map(&:id).sort.join("-")).first(12), "item_ids" => items.map(&:id) } }
      else
        result = OutfitBaselineBuilder.call(user: @user, prompt: trial["prompt"], brief: trial["brief"], locked_item_ids: trial["locked_item_ids"], shortlist_count: 5, preference_profile: profile)
        trial[key] = result[:recommendations].map { |candidate| { "id" => candidate[:id], "item_ids" => candidate[:item_ids] } }
      end
      # Save the selection before a judge failure. No candidate sampling on a retry.
      @experiment.reload
      trials = @experiment.manifest.fetch("trials")
      id = trials.find { |_id, value| value["prompt"] == trial["prompt"] }.first
      persist("trials" => trials.merge(id => trial))
    end
    trial.fetch(key).map do |candidate|
      by_id = @user.clothing_items.where(id: candidate["item_ids"]).includes(:wardrobe_item_analysis).index_by(&:id)
      { id: candidate["id"], items: candidate["item_ids"].map { |id| by_id.fetch(id) } }
    end
  end

  def repair_judgment(entry, method, trial, candidates, judgment)
    winner = judgment.fetch(:passing).first
    return judgment unless winner && !trial["#{method}_repair_attempted"] && candidates.length < 6
    trial["#{method}_repair_attempted"] = true
    save_trial(entry, trial)
    original = candidates.find { |candidate| candidate[:id] == winner["candidate_id"] }
    pools = trial.fetch("pools").transform_values { |ids| @user.clothing_items.where(id: ids).includes(:wardrobe_item_analysis).to_a }
    repair = OutfitTargetedRepair.call(brief: trial["brief"], candidate: original, evaluation: winner, pools: pools, locked_ids: trial.fetch("locked_item_ids"), excluded_ids: [], user_id: @user.id)
    return judgment unless repair
    trial.fetch("#{method}_candidates") << { "id" => repair[:id], "item_ids" => repair[:items].map(&:id) }
    save_trial(entry, trial)
    candidates << repair
    comparison = OpenrouterOutfitVisualJudge.call(brief: trial["brief"], candidates: [ original, repair ])
    repaired = comparison[:evaluations].find { |value| value["candidate_id"] == repair[:id] }
    previous = comparison[:evaluations].find { |value| value["candidate_id"] == original[:id] }
    evaluations = judgment[:evaluations].map { |entry| entry["candidate_id"] == previous["candidate_id"] ? previous : entry } + [ repaired ]
    judgment.merge(evaluations: evaluations, passing: [ OpenrouterOutfitVisualJudge.highest_ranked(evaluations) ])
  end

  def save_trial(entry, trial)
    persist("trials" => @experiment.reload.manifest.fetch("trials", {}).merge(entry.fetch("id") => trial))
  end

  def persist(values)
    @experiment.update!(manifest: @experiment.reload.manifest.merge(values))
  end
end
