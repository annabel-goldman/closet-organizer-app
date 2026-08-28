class CleanImageGenerationJob < ApplicationJob
  queue_as :ai

  def perform(workflow_id)
    workflow = AiWorkflow.includes(:stages, :user).find(workflow_id)
    return if workflow.cancelled? || workflow.succeeded? || workflow.failed?

    item = workflow.subject
    raise "Image cleaning currently requires a clothing item." unless item.is_a?(ClothingItem)
    raise "This item does not have a photo to clean." unless item.source_photo_for_cleaning.attached?

    clean_stage = nil
    verify_stage = nil
    artifact = nil
    workflow.with_lock do
      return if workflow.cancelled?

      workflow.mark_processing!
      clean_stage = workflow.stage("clean")
      verify_stage = workflow.stage("verify")
      clean_stage.processing!
      verify_stage.update!(status: "pending", error_message: nil)
      artifact = clean_stage.artifacts.create!(
        subject: item,
        kind: "cleaned_item_image",
        status: "processing",
        provider: workflow.provider,
        model: workflow.model,
        prompt_version: workflow.prompt_version,
        source_fingerprint: item.source_photo_for_cleaning.blob.checksum
      )
    end

    temporary_files = ManagedTempfiles.new
    generated = OpenrouterImageCleaner.call(
      item.source_photo_for_cleaning,
      prompt_context: (workflow.metadata["prompt_context"] || {}).deep_symbolize_keys,
      reference_photos: item_reference_photos(workflow.user, item),
      metadata_context: (workflow.metadata["metadata_context"] || {}).deep_symbolize_keys
    )
    generated_tempfile = temporary_files.track(generated.fetch(:tempfile))
    filename_root = File.basename(generated.fetch(:filename).to_s, ".*").presence || "item-clean"
    processed = CleanImageBackgroundRemover.call(
      generated_tempfile,
      filename_root: filename_root,
      temporary_files: temporary_files
    )
    processed_tempfile = temporary_files.track(processed.fetch(:tempfile))

    workflow.with_lock do
      if workflow.cancelled?
        item.update!(clean_image_status: :idle, clean_image_error_message: nil)
        return
      end

      item.cleaned_photo.attach(
        io: processed_tempfile,
        filename: processed.fetch(:filename),
        content_type: processed.fetch(:content_type)
      )
      item.update!(
        clean_image_status: :succeeded,
        clean_image_error_message: nil,
        clean_image_provider: generated.fetch(:provider),
        clean_image_model: generated.fetch(:model),
        clean_image_generated_at: Time.current
      )
      artifact.file.attach(item.cleaned_photo.blob)
      artifact.update!(
        provider: generated.fetch(:provider),
        model: generated.fetch(:model),
        diagnostics: {
          source: "item-detail",
          generated_at: Time.current.iso8601,
          publication: "automatic"
        }
      )
      artifact.approve!
      clean_stage.auto_approve!
      verify_stage.auto_approve!
      workflow.update!(completed_count: 1)
      workflow.mark_succeeded!
    end
  rescue StandardError => error
    return if workflow&.reload&.cancelled?

    item&.update(clean_image_status: :failed, clean_image_error_message: error.message)
    artifact&.update(status: "failed", error_message: error.message)
    workflow&.stages&.each { |stage| stage.fail!(error.message) if stage.status.in?(%w[pending processing]) }
    workflow&.mark_failed!(error.message)
    Rails.logger.error("Item clean workflow #{workflow_id} failed: #{error.class}: #{error.message}")
  ensure
    temporary_files&.close_all
  end

  private

  def item_reference_photos(user, item)
    source_upload = user.outfit_uploads.find_by(id: item.source_outfit_upload_id)
    return [ source_upload.source_photo ] if source_upload&.source_photo&.attached?
    return [] unless item.photo.attached?
    return [] if item.source_photo_for_cleaning.blob == item.photo.blob

    [ item.photo ]
  end
end
