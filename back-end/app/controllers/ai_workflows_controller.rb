class AiWorkflowsController < ApplicationController
  before_action :require_login
  before_action :set_workflow, only: %i[show cancel approve reject update_preview destroy_preview]

  def create
    workflow = current_user.ai_workflows.new(workflow_params)
    workflow.provider ||= "openrouter"
    workflow.model ||= ENV.fetch("OPENROUTER_MODEL", "openai/gpt-4.1-mini")

    if workflow.save
      workflow.initialize_stages!
      render json: payload(workflow), status: :accepted
    else
      render_validation_errors(workflow)
    end
  end

  def show
    render json: payload(@workflow)
  end

  def cancel
    @workflow.cancel!
    reset_cancelled_subject!
    @workflow.reload
    render json: payload(@workflow)
  end

  def approve
    stage = @workflow.stage(params[:id])
    stage.artifacts.each(&:approve!)
    stage.approve!

    if %w[modeled_item modeled_outfit].include?(@workflow.kind) && stage.key == "verify"
      @workflow.stages.where(status: "review").each do |review_stage|
        review_stage.artifacts.each(&:approve!)
        review_stage.approve!
      end
      @workflow.mark_succeeded!
    end

    @workflow.reload
    render json: payload(@workflow)
  end

  def reject
    stage = @workflow.stage(params[:id])
    if %w[modeled_item modeled_outfit].include?(@workflow.kind) && stage.key == "verify"
      @workflow.stages.where(status: "review").each do |review_stage|
        review_stage.artifacts.each(&:reject!)
        review_stage.reject!
      end
      @workflow.mark_rejected!
    else
      stage.artifacts.each(&:reject!)
      stage.reject!
      @workflow.mark_review! unless @workflow.failed? || @workflow.cancelled?
    end

    @workflow.reload
    render json: payload(@workflow)
  end

  def update_preview
    artifact = editable_modeled_artifact
    return unless artifact

    uploaded_photo = params.dig(:modeled_preview, :photo)
    if uploaded_photo.blank?
      render json: { error: "Choose an edited image to save." }, status: :unprocessable_content
      return
    end

    unless uploaded_photo.respond_to?(:content_type) && uploaded_photo.content_type.to_s.start_with?("image/")
      render json: { error: "The edited preview must be an image." }, status: :unprocessable_content
      return
    end

    if uploaded_photo.size.to_i > 10.megabytes
      render json: { error: "The edited preview must be 10 MB or smaller." }, status: :unprocessable_content
      return
    end

    edit_count = artifact.diagnostics.fetch("manual_edit_count", 0).to_i + 1
    artifact.file.attach(uploaded_photo)
    artifact.update!(
      diagnostics: artifact.diagnostics.merge(
        "manually_edited_at" => Time.current.iso8601,
        "manual_edit_count" => edit_count
      )
    )

    @workflow.reload
    render json: payload(@workflow)
  end

  def destroy_preview
    unless %w[modeled_item modeled_outfit].include?(@workflow.kind) && @workflow.status.in?(%w[review succeeded])
      render json: { error: "Only a generated modeled preview can be deleted." }, status: :unprocessable_content
      return
    end

    # Accept review-state artifacts created before modeled previews became
    # auto-approved so users can still remove those existing images.
    artifacts = @workflow.artifacts.where(status: %w[review approved]).select { |artifact| artifact.file.attached? }
    if artifacts.empty?
      render json: { error: "This modeled preview has already been deleted." }, status: :unprocessable_content
      return
    end

    artifacts.each(&:delete_file!)
    @workflow.mark_deleted!
    @workflow.reload
    render json: payload(@workflow)
  end

  private

  def reset_cancelled_subject!
    case @workflow.kind
    when "item_clean"
      @workflow.subject&.update(
        clean_image_status: :idle,
        clean_image_error_message: nil
      )
    when "outfit_upload"
      @workflow.subject&.update(status: :cancelled, error_message: nil)
    end
  end

  def editable_modeled_artifact
    unless %w[modeled_item modeled_outfit].include?(@workflow.kind) && @workflow.status.in?(%w[review succeeded])
      render json: { error: "Only a generated modeled preview can be edited." }, status: :unprocessable_content
      return
    end

    artifact = @workflow.artifacts.where(status: %w[review approved]).detect { |candidate| candidate.file.attached? }
    return artifact if artifact

    render json: { error: "This modeled preview is not available to edit." }, status: :unprocessable_content
    nil
  end

  def set_workflow
    workflow_id = params[:ai_workflow_id] || params[:id]
    @workflow = current_user.ai_workflows.includes(:stages, :artifacts).find(workflow_id)
  end

  def workflow_params
    params.require(:ai_workflow).permit(:kind, :requested_count, :prompt_version, metadata: {})
  end

  def payload(workflow)
    {
      id: workflow.id,
      kind: workflow.kind,
      status: workflow.status,
      requested_count: workflow.requested_count,
      completed_count: workflow.completed_count,
      failed_count: workflow.failed_count,
      provider: workflow.provider,
      model: workflow.model,
      prompt_version: workflow.prompt_version,
      metadata: workflow.metadata,
      error_message: workflow.error_message,
      started_at: workflow.started_at,
      completed_at: workflow.completed_at,
      stages: workflow.stages.sort_by(&:id).map do |stage|
        {
          id: stage.id,
          key: stage.key,
          status: stage.status,
          decision: stage.decision,
          attempts: stage.attempts,
          diagnostics: stage.diagnostics,
          error_message: stage.error_message,
          artifact_ids: stage.artifacts.map(&:id),
          artifacts: stage.artifacts.map do |artifact|
            {
              id: artifact.id,
              kind: artifact.kind,
              status: artifact.status,
              file_url: artifact.file.attached? ? rails_storage_proxy_url(artifact.file) : nil,
              provider: artifact.provider,
              model: artifact.model,
              prompt_version: artifact.prompt_version,
              diagnostics: artifact.diagnostics,
              error_message: artifact.error_message
            }
          end
        }
      end
    }
  end
end
