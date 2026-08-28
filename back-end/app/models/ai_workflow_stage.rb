class AiWorkflowStage < ApplicationRecord
  STATUSES = %w[pending processing review approved rejected cancelled failed skipped].freeze

  belongs_to :ai_workflow, inverse_of: :stages
  has_many :artifacts, class_name: "AiArtifact", dependent: :destroy, inverse_of: :ai_workflow_stage

  validates :key, presence: true, uniqueness: { scope: :ai_workflow_id }
  validates :status, presence: true, inclusion: { in: STATUSES }
  validates :attempts, numericality: { greater_than_or_equal_to: 0, only_integer: true }

  def processing!
    update!(status: "processing", attempts: attempts + 1, started_at: Time.current, error_message: nil)
  end

  def review!
    update!(status: "review", decision: nil, completed_at: nil, error_message: nil)
  end

  def approve!
    update!(status: "approved", decision: "approve", completed_at: Time.current)
  end

  def auto_approve!
    update!(status: "approved", decision: nil, completed_at: Time.current)
  end

  def reject!
    update!(status: "rejected", decision: "reject", completed_at: Time.current)
  end

  def cancel!
    update!(status: "cancelled", decision: nil, completed_at: Time.current, error_message: nil)
  end

  def fail!(error)
    update!(status: "failed", error_message: error.to_s, completed_at: Time.current)
  end
end
