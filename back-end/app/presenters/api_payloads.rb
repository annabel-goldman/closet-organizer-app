class ApiPayloads
  def initialize(url_helpers:)
    @url_helpers = url_helpers
  end

  def user(user, include_items: true)
    payload = user.serializable_hash(
      only: %i[id username preferred_style email avatar_url admin created_at updated_at]
    )

    payload["clothing_items_count"] = user.clothing_items.size

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
    payload
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

  def attachment_url(attachment)
    return unless attachment.attached?

    url_helpers.url_for(attachment)
  end
end
