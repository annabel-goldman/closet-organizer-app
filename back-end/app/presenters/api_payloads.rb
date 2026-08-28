class ApiPayloads
  def initialize(url_helpers:)
    @url_helpers = url_helpers
  end

  def user(user, include_items: true, include_model_references: false)
    payload = user.serializable_hash(
      only: %i[
        id username preferred_style email avatar_url admin model_reference_consent_at created_at updated_at
      ]
    )

    payload["clothing_items_count"] = user.clothing_items.size
    model_reference_scope = user.model_reference_images.ordered
    payload["model_reference_photo_attached"] = model_reference_scope.exists?
    payload["model_reference_photo_count"] = model_reference_scope.count
    if include_model_references
      payload["model_reference_photos"] = model_reference_scope.with_attached_photo.map do |reference_image|
        {
          id: reference_image.id,
          position: reference_image.position,
          photo_url: url_helpers.photo_model_reference_image_path(reference_image)
        }
      end
    end

    if include_items
      payload["clothing_items"] = user.clothing_items.order(:name).map do |item|
        clothing_item(item, include_user: false)
      end
    end

    payload
  end

  def clothing_item(clothing_item, include_user: true)
    payload = clothing_item.serializable_hash(
      only: %i[
        id
        name
        category
        brand
        date
        style_notes
        user_id
        created_at
        updated_at
        tags
        clean_image_status
        clean_image_error_message
        clean_image_provider
        clean_image_model
        clean_image_generated_at
      ]
    )

    payload["size"] = clothing_item.size
    payload["tags"] = TagListNormalizer.call(clothing_item.tags)
    payload["image_url"] = attachment_url(clothing_item.display_photo_attachment)
    payload["original_image_url"] = attachment_url(clothing_item.photo)
    payload["cleaned_image_url"] = attachment_url(clothing_item.cleaned_photo)
    payload["user"] = user(clothing_item.user, include_items: false) if include_user
    payload
  end

  def outfit_upload(outfit_upload)
    payload = outfit_upload.serializable_hash(
      only: %i[
        id
        user_id
        provider
        vision_model
        error_message
        detected_at
        created_at
        updated_at
      ]
    )

    payload["status"] = outfit_upload.status
    payload["source_photo_url"] = attachment_url(outfit_upload.source_photo)
    payload["detections"] = outfit_upload.outfit_detections.map { |detection| outfit_detection(detection) }
    workflow = outfit_upload_workflow(outfit_upload)
    payload["ai_workflow"] = ai_workflow(workflow) if workflow
    payload
  end

  def ai_workflow(workflow)
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
              file_url: attachment_url(artifact.file, proxy: true),
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

  def outfit_detection(outfit_detection)
    payload = outfit_detection.serializable_hash(
      only: %i[
        id
        outfit_upload_id
        category
        confidence
        suggested_name
        details
        position
        clean_image_status
        clean_image_error_message
        clean_image_provider
        clean_image_model
        clean_image_generated_at
        created_at
        updated_at
      ]
    )

    payload["bounding_box"] = outfit_detection.preferred_preview_box
    payload["coarse_box"] = outfit_detection.coarse_box
    payload["refined_box"] = outfit_detection.refined_box
    payload["final_box"] = outfit_detection.final_box
    payload["cleaned_image_url"] = attachment_url(outfit_detection.cleaned_photo)
    payload
  end

  def outfit(outfit)
    payload = outfit.serializable_hash(
      only: %i[
        id
        user_id
        name
        tags
        notes
        created_at
        updated_at
      ]
    )

    ordered_outfit_items = outfit.outfit_items.sort_by { |outfit_item| [ outfit_item.layer_order, outfit_item.id ] }
    generation_run = outfit.outfit_generation_run

    payload["item_ids"] = ordered_outfit_items.map(&:clothing_item_id)
    payload["generation_id"] = generation_run&.id
    payload["generated_by_ai"] = generation_run.present?
    payload["generated_item_ids"] = generation_run&.generated_item_ids || []
    modeled_workflow = outfit.ai_workflows
      .select { |workflow| workflow.kind == "modeled_outfit" }
      .max_by(&:created_at)
    payload["modeled_workflow"] = ai_workflow(modeled_workflow) if modeled_workflow
    payload["items"] = ordered_outfit_items.map do |outfit_item|
      clothing_item(outfit_item.clothing_item, include_user: false).merge(
        "outfit_item_id" => outfit_item.id,
        "layer_order" => outfit_item.layer_order,
        "collage_layout" => outfit_item.collage_layout_payload
      )
    end
    payload
  end

  private

  attr_reader :url_helpers

  def attachment_url(attachment, proxy: false)
    return unless attachment.attached?

    return url_helpers.rails_storage_proxy_url(attachment) if proxy

    url_helpers.url_for(attachment)
  end

  def outfit_upload_workflow(outfit_upload)
    AiWorkflow.find_by(subject: outfit_upload)
  end
end
