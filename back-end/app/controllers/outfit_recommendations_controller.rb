class OutfitRecommendationsController < ApplicationController
  before_action :require_login
  before_action :set_run, only: %i[show discard]

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
      constraints: {
        "locked_item_ids" => owned_item_ids(recommendation_params[:locked_item_ids]),
        "draft_metadata" => normalized_draft_metadata
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

  def discard
    option = @run.options.passing.find(discard_params[:option_id])
    event = OutfitRecommendationFeedbackRecorder.call(
      user: current_user,
      run: @run,
      option: option,
      event_type: "none",
      metadata: { "source" => "outfit_cart_clear" }
    )
    render json: { id: event.id, event_type: event.event_type }, status: :created
  rescue ActiveRecord::RecordInvalid => error
    render_validation_errors(error.record)
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
      model: ENV.fetch("OPENROUTER_EMBEDDING_MODEL", OpenrouterWardrobeEmbedder::DEFAULT_MODEL),
      prompt_version: "outfit-cart-visual-selection-v1",
      requested_count: 1,
      metadata: metadata.merge("run_id" => run.id)
    )
    workflow.initialize_stages!
    workflow
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
      "visual_selector" => ENV.fetch("OPENROUTER_OUTFIT_JUDGE_MODEL", OpenrouterOutfitVisualJudge::DEFAULT_MODEL)
    }
  end

  def recommendation_params
    params.require(:outfit_recommendation).permit(
      :prompt,
      locked_item_ids: [],
      draft_metadata: [ :name, :notes, { tags: [] } ]
    )
  end

  def normalized_draft_metadata
    metadata = recommendation_params[:draft_metadata]
    return {} if metadata.blank?

    {
      "name" => metadata[:name].to_s.squish.truncate(InputLengthPolicy::MAX_OUTFIT_NAME),
      "tags" => TagListNormalizer.call(metadata[:tags]).first(InputLengthPolicy::MAX_TAGS_PER_RECORD),
      "notes" => metadata[:notes].to_s.squish.truncate(InputLengthPolicy::MAX_OUTFIT_NOTES)
    }
  end

  def discard_params
    params.require(:outfit_recommendation).permit(:option_id)
  end
end
