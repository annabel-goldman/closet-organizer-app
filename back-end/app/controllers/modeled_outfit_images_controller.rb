class ModeledOutfitImagesController < ApplicationController
  before_action :require_login
  before_action :set_outfit

  def create
    unless current_user.model_reference_images.exists? && current_user.model_reference_consent_at.present?
      render json: { error: "Add a private model reference photo before creating a modeled preview." }, status: :unprocessable_content
      return
    end

    items = requested_outfit_items
    return if performed?

    if items.empty?
      render json: { error: "Add at least one item to this outfit before modeling the full look." }, status: :unprocessable_content
      return
    end

    unless items.all? { |item| item.display_photo_attachment.attached? }
      render json: { error: "Every item in this outfit needs a photo before modeling the full look." }, status: :unprocessable_content
      return
    end

    flatlay_snapshot = params[:flatlay_snapshot]
    return unless valid_flatlay_snapshot?(flatlay_snapshot)

    reference_count = current_user.model_reference_images.count + (flatlay_snapshot.present? ? 1 : 0)
    if items.length + reference_count > OpenrouterImageCleaner::MAX_MODELED_OUTFIT_REFERENCES
      render json: {
        error: "This modeled outfit can use at most #{OpenrouterImageCleaner::MAX_MODELED_OUTFIT_REFERENCES} total garment, model-reference, and flat-lay images."
      }, status: :unprocessable_content
      return
    end

    workflow = current_user.ai_workflows.create!(
      kind: "modeled_outfit",
      subject: @outfit,
      requested_count: 1,
      provider: "openrouter",
      model: OpenrouterImageCleaner.modeled_outfit_model,
      prompt_version: "modeled-outfit-v5-flatlay-composition",
      metadata: {
        source: "outfit-detail",
        outfit_id: @outfit.id,
        item_ids: items.map(&:id),
        name: draft_value(:name, @outfit.name),
        tags: draft_value(:tags, @outfit.tags),
        notes: draft_value(:notes, @outfit.notes),
        source_state: modeled_outfit_params.key?(:item_ids) ? "editor_draft" : "saved_outfit",
        flatlay_snapshot_attached: flatlay_snapshot.present?
      }
    )
    workflow.initialize_stages!
    workflow.input_file.attach(flatlay_snapshot) if flatlay_snapshot.present?
    ModeledOutfitGenerationJob.perform_later(workflow.id)

    render json: payloads.ai_workflow(workflow), status: :accepted
  rescue ActiveRecord::RecordInvalid => error
    render_validation_errors(error.record)
  end

  private

  def set_outfit
    @outfit = current_user.outfits.includes(outfit_items: :clothing_item).find(params[:id])
  end

  def saved_outfit_items
    @outfit.outfit_items.sort_by { |outfit_item| [ outfit_item.layer_order, outfit_item.id ] }.map(&:clothing_item)
  end

  def requested_outfit_items
    return saved_outfit_items unless modeled_outfit_params.key?(:item_ids)

    item_ids = Array(modeled_outfit_params[:item_ids]).reject(&:blank?).map(&:to_i).uniq
    return [] if item_ids.empty?

    items_by_id = current_user.clothing_items.where(id: item_ids).index_by(&:id)
    if items_by_id.length != item_ids.length
      render json: { error: "Modeled outfits can only use items from your closet." }, status: :unprocessable_content
      return []
    end

    item_ids.map { |item_id| items_by_id.fetch(item_id) }
  end

  def modeled_outfit_params
    @modeled_outfit_params ||= params
      .fetch(:modeled_outfit, ActionController::Parameters.new)
      .permit(:name, :notes, tags: [], item_ids: [])
  end

  def draft_value(key, saved_value)
    modeled_outfit_params.key?(key) ? modeled_outfit_params[key] : saved_value
  end

  def valid_flatlay_snapshot?(snapshot)
    return true if snapshot.blank?

    unless snapshot.respond_to?(:content_type) && snapshot.content_type.to_s.start_with?("image/")
      render json: { error: "The flat-lay snapshot must be an image." }, status: :unprocessable_content
      return false
    end

    if snapshot.size.to_i > 10.megabytes
      render json: { error: "The flat-lay snapshot must be 10 MB or smaller." }, status: :unprocessable_content
      return false
    end

    true
  end
end
