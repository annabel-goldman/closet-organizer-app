class ModeledOutfitGenerationJob < ApplicationJob
  queue_as :ai

  def perform(workflow_id)
    workflow = AiWorkflow.includes(:stages, :user).find(workflow_id)
    return if ai_workflow_terminal?(workflow)

    outfit = workflow.subject
    raise "Modeled previews currently require an outfit." unless outfit.is_a?(Outfit)
    reference_images = workflow.user.model_reference_images.with_attached_photo.ordered.to_a
    raise "A private model reference photo is required." unless reference_images.any? && workflow.user.model_reference_consent_at.present?

    items = workflow_items(workflow, outfit)
    raise "Add at least one item to this outfit before modeling the full look." if items.empty?
    raise "Every item in this outfit needs a photo before modeling the full look." unless items.all? { |item| item.display_photo_attachment.attached? }
    if items.length + reference_images.length > OpenrouterImageCleaner::MAX_MODELED_OUTFIT_REFERENCES
      raise "Modeled outfits support at most #{OpenrouterImageCleaner::MAX_MODELED_OUTFIT_REFERENCES} total outfit and model-reference images."
    end

    prepare_stage = nil
    modeled_stage = nil
    verify_stage = nil
    artifact = nil
    workflow.with_lock do
      return if workflow.cancelled? || workflow.succeeded? || workflow.failed?

      workflow.mark_processing!
      prepare_stage = workflow.stage("prepare")
      modeled_stage = workflow.stage("modeled")
      verify_stage = workflow.stage("verify")
      prepare_stage.processing!
      modeled_stage.processing!
      verify_stage.update!(status: "pending", error_message: nil)

      artifact = modeled_stage.artifacts.create!(
        subject: outfit,
        kind: "modeled_outfit_image",
        status: "processing",
        provider: workflow.provider,
        model: workflow.model,
        prompt_version: workflow.prompt_version,
        source_fingerprint: (
          items.map { |item| item.display_photo_attachment.blob.checksum } +
          reference_images.map { |reference| reference.photo.blob.checksum } +
          [ workflow.input_file.attached? ? workflow.input_file.blob.checksum : nil ]
        ).compact.join(":")
      )
    end

    outfit_context = workflow_outfit_context(workflow, outfit)
    primary_item, *additional_items = items
    generated = OpenrouterImageCleaner.call(
      primary_item.display_photo_attachment,
      mode: :modeled_outfit,
      model: workflow.model,
      prompt_context: {
        name: outfit_context[:name],
        notes: outfit_context[:notes],
        items: items.map { |item| { name: item.name, category: item.category, style: item.style_notes, tags: item.tags } }
      },
      reference_photos: additional_items.each_with_index.map do |item, index|
        {
          photo: item.display_photo_attachment,
          label: "Outfit piece #{index + 2} (#{item.category.presence || "clothing item"}):"
        }
      end + flatlay_reference(workflow) + reference_images.each_with_index.map do |reference_image, index|
        {
          photo: reference_image.photo,
          label: "Private model reference photo #{index + 1} of #{reference_images.length}:"
        }
      end,
      metadata_context: {
        name: outfit_context[:name],
        tags: outfit_context[:tags],
        notes: outfit_context[:notes]
      }
    )

    # The provider request cannot be interrupted once it is in flight. Serialize
    # publication against cancellation so a late response can never win the race.
    workflow.with_lock do
      return if workflow.cancelled?

      artifact.file.attach(
        io: generated.fetch(:tempfile),
        filename: generated.fetch(:filename).sub(/-clean\.png\z/, "-modeled.png"),
        content_type: generated.fetch(:content_type)
      )
      artifact.update!(
        provider: generated.fetch(:provider),
        model: generated.fetch(:model),
        diagnostics: {
          source: "outfit-detail",
          source_state: workflow.metadata["source_state"] || "saved_outfit",
          item_ids: items.map(&:id),
          generated_at: Time.current.iso8601,
          item_count: items.length,
          reference_count: reference_images.length + (workflow.input_file.attached? ? 1 : 0),
          flatlay_composition_reference: workflow.input_file.attached?,
          provider_api: generated.fetch(:provider_api),
          aspect_ratio: generated.fetch(:aspect_ratio),
          resolution: generated.fetch(:resolution),
          usage: generated[:usage],
          publication: "automatic"
        }
      )
      artifact.approve!
      prepare_stage.auto_approve!
      modeled_stage.auto_approve!
      verify_stage.auto_approve!
      workflow.update!(completed_count: 1)
      workflow.mark_succeeded!
    end
  rescue StandardError => error
    fail_ai_workflow!(workflow, error, context: "Modeled outfit workflow #{workflow_id}")
  ensure
    generated&.fetch(:tempfile, nil)&.close! if defined?(generated)
    workflow&.input_file&.purge if workflow&.input_file&.attached? && workflow.status.in?(%w[succeeded failed cancelled])
  end

  private

  def flatlay_reference(workflow)
    return [] unless workflow.input_file.attached?

    [
      {
        photo: workflow.input_file,
        label: "Styled flat-lay composition reference (use for styling and layering, not garment identity):"
      }
    ]
  end

  def workflow_items(workflow, outfit)
    item_ids = Array(workflow.metadata["item_ids"]).map(&:to_i).uniq
    return saved_outfit_items(outfit) if item_ids.empty?

    items_by_id = workflow.user.clothing_items.where(id: item_ids).index_by(&:id)
    raise "One or more items in this modeled outfit are no longer available." if items_by_id.length != item_ids.length

    item_ids.map { |item_id| items_by_id.fetch(item_id) }
  end

  def saved_outfit_items(outfit)
    outfit.outfit_items.includes(:clothing_item).sort_by do |outfit_item|
      [ outfit_item.layer_order, outfit_item.id ]
    end.map(&:clothing_item)
  end

  def workflow_outfit_context(workflow, outfit)
    metadata = workflow.metadata
    {
      name: metadata.key?("name") ? metadata["name"] : outfit.name,
      tags: metadata.key?("tags") ? Array(metadata["tags"]) : outfit.tags,
      notes: metadata.key?("notes") ? metadata["notes"] : outfit.notes
    }
  end
end
