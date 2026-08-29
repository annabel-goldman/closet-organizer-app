class ApplicationJob < ActiveJob::Base
  # Automatically retry jobs that encountered a deadlock
  # retry_on ActiveRecord::Deadlocked

  # Most jobs are safe to ignore if the underlying records are no longer available
  # discard_on ActiveJob::DeserializationError

  private

  def ai_workflow_terminal?(workflow)
    workflow.cancelled? || workflow.succeeded? || workflow.failed?
  end

  def ai_workflow_cancelled_after_reload?(workflow)
    workflow&.reload&.cancelled?
  end

  def fail_ai_workflow!(workflow, error, context:)
    return false if ai_workflow_cancelled_after_reload?(workflow)

    workflow&.stages&.each do |stage|
      stage.fail!(error.message) if stage.status.in?(%w[pending processing])
    end
    workflow&.mark_failed!(error.message)
    Rails.logger.error("#{context} failed: #{error.class}: #{error.message}")
    true
  end
end
