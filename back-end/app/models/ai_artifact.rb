class AiArtifact < ApplicationRecord
  STATUSES = %w[pending processing review approved rejected cancelled deleted failed].freeze

  belongs_to :ai_workflow_stage, inverse_of: :artifacts
  belongs_to :subject, polymorphic: true, optional: true
  has_one_attached :file

  validates :kind, presence: true
  validates :status, presence: true, inclusion: { in: STATUSES }

  def approve!
    update!(status: "approved", approved_at: Time.current, rejected_at: nil)
  end

  def reject!
    update!(status: "rejected", rejected_at: Time.current, approved_at: nil)
  end

  def cancel!
    file.purge if file.attached?
    update!(
      status: "cancelled",
      approved_at: nil,
      rejected_at: nil,
      diagnostics: diagnostics.merge("cancelled_at" => Time.current.iso8601)
    )
  end

  def delete_file!
    file.purge if file.attached?
    update!(
      status: "deleted",
      diagnostics: diagnostics.merge("deleted_at" => Time.current.iso8601)
    )
  end
end
