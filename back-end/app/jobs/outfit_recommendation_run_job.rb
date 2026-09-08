class OutfitRecommendationRunJob < ApplicationJob
  queue_as :ai

  JUDGE_RUBRIC = {
    "dimensions" => OpenrouterOutfitVisualJudge::RUBRIC_KEYS,
    "quality_floor" => OpenrouterOutfitVisualJudge::DEFAULT_QUALITY_FLOOR,
    "hard_violations_allowed" => false
  }.freeze

  def perform(workflow_id, start_at: "plan")
    workflow = AiWorkflow.includes(:stages, :user).find(workflow_id)
    return if ai_workflow_terminal?(workflow)

    run = workflow.subject
    raise "This workflow is not attached to an outfit recommendation run." unless run.is_a?(OutfitRecommendationRun)

    workflow.mark_processing!
    run.update!(status: :processing, error_message: nil, completed_at: nil)
    prepare_retry_stages(workflow) if start_at == "judge"

    plan_run(run, workflow) unless start_at == "judge"
    return if ai_workflow_cancelled_after_reload?(workflow)

    retrieve_candidates(run, workflow) unless start_at == "judge"
    return if ai_workflow_cancelled_after_reload?(workflow)

    judge_candidates(run, workflow)
    return if ai_workflow_cancelled_after_reload?(workflow)

    finalize_run(run, workflow)
  rescue StandardError => error
    run&.update(status: :failed, error_message: error.message, completed_at: Time.current)
    fail_ai_workflow!(workflow, error, context: "Outfit recommendation workflow #{workflow_id}")
  end

  private

  def plan_run(run, workflow)
    stage = workflow.stage("plan")
    stage.processing!
    locked_items = run.user.clothing_items.where(id: run.constraints.fetch("locked_item_ids", []))
    brief = OpenrouterOutfitBriefParser.call(run.prompt, locked_items: locked_items)
    run.update!(
      structured_brief: brief.except("usage", "model"),
      models: run.models.merge("planner" => brief["model"]),
      usage: run.usage.merge("planner" => brief["usage"] || {})
    )
    stage.update!(diagnostics: { "anchor" => brief["anchor"], "garment_roles" => brief["garment_roles"] })
    stage.auto_approve!
  end

  def retrieve_candidates(run, workflow)
    stage = workflow.stage("retrieve")
    stage.processing!
    result = OutfitRecommendationBuilder.call(
      user: run.user,
      prompt: run.prompt,
      locked_item_ids: run.constraints.fetch("locked_item_ids", []),
      excluded_item_ids: run.constraints.fetch("excluded_item_ids", []),
      shortlist_count: OutfitRecommenderV2.shortlist_size,
      brief: run.structured_brief
    )

    candidates = result.fetch(:recommendations)
    run.options.delete_all
    candidates.each_with_index do |candidate, index|
      run.options.create!(
        rank: index + 1,
        status: :candidate,
        title: candidate.fetch(:title),
        summary: candidate.fetch(:summary),
        clothing_item_ids: candidate.fetch(:item_ids),
        local_score: candidate.fetch(:score),
        reasons: candidate.fetch(:reasons)
      )
    end
    run.update!(
      candidate_item_sets: candidates.map { |candidate| { "id" => candidate.fetch(:id), "item_ids" => candidate.fetch(:item_ids) } },
      models: run.models.merge(result.fetch(:models).stringify_keys),
      usage: run.usage.merge(result.fetch(:usage).stringify_keys)
    )
    stage.update!(diagnostics: { "candidate_count" => candidates.length })
    stage.auto_approve!
  end

  def judge_candidates(run, workflow)
    stage = workflow.stage("judge")
    stage.processing!
    candidates = run.candidate_item_sets.map do |candidate|
      items = run.user.clothing_items.where(id: candidate.fetch("item_ids")).includes(
        image_versions: { image_attachment: :blob }
      ).with_attached_photo.with_attached_cleaned_photo.to_a
      raise "A shortlisted outfit item is no longer available." unless items.length == candidate.fetch("item_ids").length

      { id: candidate.fetch("id"), items: candidate.fetch("item_ids").filter_map { |id| items.find { |item| item.id == id } } }
    end
    result = OpenrouterOutfitVisualJudge.call(brief: run.structured_brief, candidates: candidates)
    evaluations = result.fetch(:evaluations).index_by { |value| value.fetch("candidate_id") }
    passing_ids = result.fetch(:passing).map { |value| value.fetch("candidate_id") }

    run.candidate_item_sets.each_with_index do |candidate, index|
      evaluation = evaluations.fetch(candidate.fetch("id").to_s)
      option = run.options.find_by!(rank: index + 1)
      option.update!(
        status: passing_ids.include?(candidate.fetch("id").to_s) ? :passing : :rejected,
        title: evaluation.fetch("title").presence || option.title,
        summary: evaluation.fetch("summary").presence || option.summary,
        judge_score: evaluation.fetch("overall_score"),
        judge_scores: evaluation.fetch("scores"),
        reasons: evaluation.fetch("reasons"),
        hard_violations: evaluation.fetch("hard_violations")
      )
    end
    run.update!(
      judge_rubric: JUDGE_RUBRIC.merge("quality_floor" => result.fetch(:quality_floor)),
      models: run.models.merge("judge" => result.fetch(:model)),
      usage: run.usage.merge("judge" => result.fetch(:usage))
    )
    stage.update!(diagnostics: { "candidate_count" => candidates.length, "passing_count" => passing_ids.length })
    stage.auto_approve!
  end

  def finalize_run(run, workflow)
    stage = workflow.stage("finalize")
    stage.processing!
    passing_count = run.options.passing.count
    message = if passing_count.zero?
      "No complete look cleared the quality bar. #{limiting_constraints(run)}"
    elsif passing_count < 3
      "Only #{passing_count} #{'look'.pluralize(passing_count)} cleared the quality bar, so no weaker options were added."
    end
    run.update!(status: :succeeded, result_message: message, error_message: nil, completed_at: Time.current)
    stage.update!(diagnostics: { "returned_count" => passing_count })
    stage.auto_approve!
    workflow.update!(completed_count: passing_count)
    workflow.mark_succeeded!
  end

  def limiting_constraints(run)
    violations = run.options.flat_map(&:hard_violations).reject(&:blank?).tally.sort_by { |_value, count| -count }.first(2).map(&:first)
    return "Your closet could not satisfy the requested combination of color, weather, occasion, and garment roles." if violations.empty?

    "The main limitations were: #{violations.to_sentence}."
  end

  def prepare_retry_stages(workflow)
    workflow.stages.where(key: %w[plan retrieve]).update_all(status: "skipped", completed_at: Time.current)
  end
end
