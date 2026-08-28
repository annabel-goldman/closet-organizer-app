class ModeledImageGenerationJob < ApplicationJob
  queue_as :ai

  def perform(workflow_id)
    workflow = AiWorkflow.includes(:stages, :user).find(workflow_id)
    return if workflow.cancelled? || workflow.succeeded? || workflow.failed?

    item = workflow.subject
    raise "Modeled previews currently require a clothing item." unless item.is_a?(ClothingItem)
    reference_images = workflow.user.model_reference_images.with_attached_photo.ordered.to_a
    raise "A private model reference photo is required." unless reference_images.any? && workflow.user.model_reference_consent_at.present?
    raise "This item does not have a photo to model." unless item.display_photo_attachment.attached?

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
        subject: item,
        kind: "modeled_image",
        status: "processing",
        provider: workflow.provider,
        model: workflow.model,
        prompt_version: workflow.prompt_version,
        source_fingerprint: ([ item.display_photo_attachment.blob.checksum ] + reference_images.map { |reference| reference.photo.blob.checksum }).compact.join(":")
      )
    end

    generated = OpenrouterImageCleaner.call(
      item.display_photo_attachment,
      mode: :modeled,
      model: workflow.model,
      prompt_context: {
        name: item.name,
        category: item.category,
        style: item.style_notes,
        hard_constraints: item.tags
      },
      reference_photos: reference_images.each_with_index.map do |reference_image, index|
        {
          photo: reference_image.photo,
          label: "Private model reference photo #{index + 1} of #{reference_images.length}:"
        }
      end,
      metadata_context: {
        name: item.name,
        category: item.category,
        brand: item.brand,
        size: item.size,
        tags: item.tags,
        style_notes: item.style_notes
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
          source: "item-detail",
          generated_at: Time.current.iso8601,
          reference_count: reference_images.length,
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
    return if workflow&.reload&.cancelled?

    workflow&.stages&.each { |stage| stage.fail!(error.message) if stage.status.in?(%w[pending processing]) }
    workflow&.mark_failed!(error.message)
    Rails.logger.error("Modeled image workflow #{workflow_id} failed: #{error.class}: #{error.message}")
  ensure
    generated&.fetch(:tempfile, nil)&.close! if defined?(generated)
  end
end
