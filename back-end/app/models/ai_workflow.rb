class AiWorkflow < ApplicationRecord
  KINDS = %w[
    outfit_upload
    item_clean
    outfit_generation
    modeled_item
    modeled_outfit
    lookbook
  ].freeze

  STAGES_BY_KIND = {
    "outfit_upload" => %w[detect crop],
    "item_clean" => %w[clean verify],
    "outfit_generation" => %w[curate save],
    "modeled_item" => %w[prepare modeled verify],
    "modeled_outfit" => %w[prepare modeled verify],
    "lookbook" => %w[curate modeled verify]
  }.freeze

  belongs_to :user
  belongs_to :subject, polymorphic: true, optional: true
  has_one_attached :input_file
  has_many :stages, class_name: "AiWorkflowStage", dependent: :destroy, inverse_of: :ai_workflow
  has_many :artifacts, through: :stages

  enum :status, {
    pending: "pending",
    processing: "processing",
    review: "review",
    succeeded: "succeeded",
    rejected: "rejected",
    deleted: "deleted",
    failed: "failed",
    cancelled: "cancelled"
  }

  validates :kind, presence: true, inclusion: { in: KINDS }
  validates :completed_count, :failed_count, numericality: { greater_than_or_equal_to: 0, only_integer: true }
  validates :requested_count, numericality: { greater_than: 0, only_integer: true }, allow_nil: true

  def initialize_stages!
    STAGES_BY_KIND.fetch(kind, []).each do |stage_key|
      stages.find_or_create_by!(key: stage_key)
    end
    stages.reload
  end

  def stage(key)
    stages.find_by!(key: key.to_s)
  end

  def mark_processing!
    update!(status: :processing, started_at: started_at || Time.current, error_message: nil)
  end

  def mark_review!
    update!(status: :review, completed_at: nil, error_message: nil)
  end

  def mark_succeeded!
    update!(status: :succeeded, completed_at: Time.current, error_message: nil)
  end

  def mark_rejected!
    update!(status: :rejected, completed_at: Time.current, error_message: nil)
  end

  def mark_deleted!
    update!(status: :deleted, completed_at: Time.current, error_message: nil)
  end

  def mark_failed!(error)
    update!(
      status: :failed,
      failed_count: failed_count + 1,
      completed_at: Time.current,
      error_message: error.to_s
    )
  end

  def mark_cancelled!
    update!(status: :cancelled, completed_at: Time.current)
  end

  def cancel!
    with_lock do
      return if status.in?(%w[succeeded rejected deleted failed cancelled])

      stages.where(status: %w[pending processing review]).find_each do |stage|
        stage.artifacts.where(status: %w[pending processing review]).find_each(&:cancel!)
        stage.cancel!
      end
      mark_cancelled!
    end
  end
end
