class BackfillRejectedModeledWorkflows < ActiveRecord::Migration[8.1]
  class MigrationWorkflow < ActiveRecord::Base
    self.table_name = "ai_workflows"
  end

  class MigrationStage < ActiveRecord::Base
    self.table_name = "ai_workflow_stages"
  end

  class MigrationArtifact < ActiveRecord::Base
    self.table_name = "ai_artifacts"
  end

  def up
    rejected_workflow_ids = MigrationStage
      .where(key: "verify", status: "rejected")
      .where(ai_workflow_id: MigrationWorkflow.where(kind: %w[modeled_item modeled_outfit]))
      .pluck(:ai_workflow_id)

    return if rejected_workflow_ids.empty?

    rejected_stage_ids = MigrationStage
      .where(ai_workflow_id: rejected_workflow_ids, status: "review")
      .pluck(:id)

    MigrationArtifact
      .where(ai_workflow_stage_id: rejected_stage_ids, status: "review")
      .update_all(status: "rejected", rejected_at: Time.current, updated_at: Time.current)
    MigrationStage
      .where(id: rejected_stage_ids)
      .update_all(status: "rejected", decision: "reject", completed_at: Time.current, updated_at: Time.current)
    MigrationWorkflow
      .where(id: rejected_workflow_ids)
      .update_all(status: "rejected", completed_at: Time.current, updated_at: Time.current)
  end

  def down
    raise ActiveRecord::IrreversibleMigration, "The prior review state of rejected modeled workflows cannot be inferred."
  end
end
