class OutfitUploadAnalysisJob < ApplicationJob
  queue_as :default

  def perform(outfit_upload_id)
    outfit_upload = OutfitUpload.find_by(id: outfit_upload_id)
    return unless outfit_upload

    workflow = AiWorkflow.find_by(subject: outfit_upload)
    if workflow
      workflow.with_lock do
        return if workflow.cancelled?

        workflow.mark_processing!
        workflow.stage("detect").processing!
        workflow.stage("crop").processing!
      end
    end
    outfit_upload.analyze!
    if workflow&.reload&.cancelled?
      outfit_upload.outfit_detections.destroy_all
      outfit_upload.update!(status: :cancelled, error_message: nil)
      return
    end
    if outfit_upload.outfit_detections.exists?
      workflow&.stage("detect")&.review!
      workflow&.stage("crop")&.review!
      workflow&.mark_review!
    else
      workflow&.stage("detect")&.approve!
      workflow&.stage("crop")&.approve!
      workflow&.mark_succeeded!
    end
  rescue StandardError => error
    if workflow&.reload&.cancelled?
      outfit_upload.outfit_detections.destroy_all
      outfit_upload.update!(status: :cancelled, error_message: nil)
      return
    end

    workflow&.stage("detect")&.fail!(error) if workflow
    workflow&.stage("crop")&.fail!(error) if workflow
    workflow&.mark_failed!(error) if workflow
    Rails.logger.error(
      "OutfitUploadAnalysisJob failed for upload #{outfit_upload_id}: " \
      "#{error.class}: #{error.message}"
    )
  end
end
