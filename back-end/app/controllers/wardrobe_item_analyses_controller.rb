class WardrobeItemAnalysesController < ApplicationController
  before_action :require_login

  def show
    render json: status_payload
  end

  def create
    if current_user.clothing_items.none?
      render json: { error: "Add at least one closet item before preparing outfit suggestions." }, status: :unprocessable_content
      return
    end

    active = current_user.ai_workflows
      .where(kind: "wardrobe_index", status: %w[pending processing])
      .order(created_at: :desc)
      .first
    workflow = active || current_user.ai_workflows.create!(
      kind: "wardrobe_index",
      status: :pending,
      provider: "openrouter",
      model: ENV.fetch("OPENROUTER_ENRICHMENT_MODEL", OpenrouterWardrobeEnricher::DEFAULT_MODEL),
      prompt_version: WardrobeItemEnricher::ENRICHMENT_VERSION,
      requested_count: [ current_user.clothing_items.count, 1 ].max,
      metadata: { "purpose" => "outfit_recommendations" }
    )

    unless active
      workflow.initialize_stages!
      WardrobeAnalysisBackfillJob.perform_later(workflow.id)
    end

    render json: status_payload.merge(workflow: payloads.ai_workflow(workflow.reload)), status: :accepted
  end

  private

  def status_payload
    status = WardrobeAnalysisStatus.call(current_user)
    workflow = status.delete(:workflow)
    status.merge(workflow: workflow ? payloads.ai_workflow(workflow) : nil)
  end
end
