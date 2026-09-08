class OutfitRecommendationsController < ApplicationController
  before_action :require_login
  before_action :set_run, only: %i[show feedback retry_judge]

  def create
    unless OutfitRecommenderV2.enabled?
      render json: { error: "Outfit Generator V2 is not enabled." }, status: :service_unavailable
      return
    end

    status = WardrobeAnalysisStatus.call(current_user)
    if !status[:complete] || status[:ready].zero?
      workflow = status.delete(:workflow)
      render json: status.merge(
        code: "wardrobe_not_ready",
        error: "Finish the one-time closet preparation before creating AI outfits.",
        workflow: workflow ? payloads.ai_workflow(workflow) : nil
      ), status: :conflict
      return
    end

    run = current_user.outfit_recommendation_runs.create!(
      prompt: recommendation_params[:prompt],
      parent_run: parent_run,
      constraints: {
        "locked_item_ids" => owned_item_ids(recommendation_params[:locked_item_ids]),
        "excluded_item_ids" => owned_item_ids(recommendation_params[:excluded_item_ids])
      },
      models: configured_models
    )
    workflow = create_workflow(run)
    OutfitRecommendationRunJob.perform_later(workflow.id)
    render json: payloads.outfit_recommendation_run(run.reload), status: :accepted
  rescue ActiveRecord::RecordInvalid => error
    render_validation_errors(error.record)
  end

  def show
    render json: payloads.outfit_recommendation_run(@run)
  end

  def feedback
    event_type = feedback_params[:event_type].to_s
    option = feedback_params[:option_id].present? ? @run.options.find(feedback_params[:option_id]) : nil
    item = feedback_params[:clothing_item_id].present? ? current_user.clothing_items.find(feedback_params[:clothing_item_id]) : nil
    if %w[best keep].include?(event_type) && option.nil? && item.nil?
      render json: { error: "Choose a look or item for this feedback." }, status: :unprocessable_content
      return
    end

    event = OutfitRecommendationFeedbackRecorder.call(
      user: current_user,
      run: @run,
      event_type: event_type,
      option: option,
      clothing_item: item,
      metadata: feedback_params[:metadata]&.to_h || {}
    )
    render json: { id: event.id, event_type: event.event_type }, status: :created
  rescue ActiveRecord::RecordInvalid => error
    render_validation_errors(error.record)
  end

  def retry_judge
    if @run.candidate_item_sets.blank?
      render json: { error: "This run does not have a saved shortlist to judge." }, status: :unprocessable_content
      return
    end

    @run.update!(status: :pending, error_message: nil, completed_at: nil)
    @run.options.update_all(status: "candidate", judge_score: nil, judge_scores: {}, hard_violations: [])
    workflow = create_workflow(@run, metadata: { "retry_stage" => "judge" })
    OutfitRecommendationRunJob.perform_later(workflow.id, start_at: "judge")
    render json: payloads.outfit_recommendation_run(@run.reload), status: :accepted
  end

  private

  def set_run
    @run = current_user.outfit_recommendation_runs.includes(:options, ai_workflows: [ :stages, :artifacts ]).find(params[:id])
  end

  def create_workflow(run, metadata: {})
    workflow = current_user.ai_workflows.create!(
      subject: run,
      kind: "outfit_recommendation",
      status: :pending,
      provider: "openrouter",
      model: ENV.fetch("OPENROUTER_OUTFIT_JUDGE_MODEL", OpenrouterOutfitVisualJudge::DEFAULT_MODEL),
      prompt_version: "outfit-recommender-v2",
      requested_count: OutfitRecommenderV2.shortlist_size,
      metadata: metadata.merge("run_id" => run.id)
    )
    workflow.initialize_stages!
    workflow
  end

  def parent_run
    return if recommendation_params[:parent_run_id].blank?

    current_user.outfit_recommendation_runs.find(recommendation_params[:parent_run_id])
  end

  def owned_item_ids(values)
    ids = Array(values).filter_map { |value| Integer(value, exception: false) }.uniq
    owned = current_user.clothing_items.where(id: ids).pluck(:id)
    raise ActiveRecord::RecordNotFound, "A selected closet item was not found." unless owned.length == ids.length

    owned
  end

  def configured_models
    {
      "embedding" => ENV.fetch("OPENROUTER_EMBEDDING_MODEL", OpenrouterWardrobeEmbedder::DEFAULT_MODEL),
      "enrichment" => ENV.fetch("OPENROUTER_ENRICHMENT_MODEL", OpenrouterWardrobeEnricher::DEFAULT_MODEL),
      "planner" => ENV.fetch("OPENROUTER_OUTFIT_PLANNER_MODEL", OpenrouterOutfitBriefParser::DEFAULT_MODEL),
      "judge" => ENV.fetch("OPENROUTER_OUTFIT_JUDGE_MODEL", OpenrouterOutfitVisualJudge::DEFAULT_MODEL)
    }
  end

  def recommendation_params
    params.require(:outfit_recommendation).permit(:prompt, :parent_run_id, locked_item_ids: [], excluded_item_ids: [])
  end

  def feedback_params
    params.require(:feedback).permit(:event_type, :option_id, :clothing_item_id, metadata: {})
  end
end
