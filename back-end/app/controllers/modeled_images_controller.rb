class ModeledImagesController < ApplicationController
  before_action :require_login
  before_action :set_clothing_item

  def create
    unless current_user.model_reference_images.exists? && current_user.model_reference_consent_at.present?
      render json: { error: "Add a private model reference photo before creating a modeled preview." }, status: :unprocessable_content
      return
    end

    unless @clothing_item.display_photo_attachment.attached?
      render json: { error: "This item does not have a photo to model." }, status: :unprocessable_content
      return
    end

    workflow = current_user.ai_workflows.create!(
      kind: "modeled_item",
      subject: @clothing_item,
      requested_count: 1,
      provider: "openrouter",
      model: ENV.fetch("OPENROUTER_IMAGE_CLEAN_MODEL", OpenrouterImageCleaner::DEFAULT_MODEL),
      prompt_version: "modeled-item-v4-white-cutout",
      metadata: { source: "item-detail", item_id: @clothing_item.id }
    )
    workflow.initialize_stages!
    ModeledImageGenerationJob.perform_later(workflow.id)

    render json: payloads.ai_workflow(workflow), status: :accepted
  rescue ActiveRecord::RecordInvalid => error
    render_validation_errors(error.record)
  end

  private

  def set_clothing_item
    @clothing_item = current_user.clothing_items.find(params[:id])
  end
end
