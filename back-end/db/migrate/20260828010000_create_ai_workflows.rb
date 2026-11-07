class CreateAiWorkflows < ActiveRecord::Migration[8.1]
  def change
    create_table :ai_workflows do |t|
      t.references :user, null: false, foreign_key: true
      t.string :kind, null: false
      t.string :status, null: false, default: "pending"
      t.string :provider
      t.string :model
      t.string :prompt_version
      t.integer :requested_count
      t.integer :completed_count, null: false, default: 0
      t.integer :failed_count, null: false, default: 0
      t.json :metadata, null: false, default: {}
      t.text :error_message
      t.references :subject, polymorphic: true
      t.datetime :started_at
      t.datetime :completed_at
      t.timestamps

      t.index [ :user_id, :status ]
    end

    create_table :ai_workflow_stages do |t|
      t.references :ai_workflow, null: false, foreign_key: true
      t.string :key, null: false
      t.string :status, null: false, default: "pending"
      t.string :decision
      t.integer :attempts, null: false, default: 0
      t.text :prompt
      t.json :diagnostics, null: false, default: {}
      t.text :error_message
      t.datetime :started_at
      t.datetime :completed_at
      t.timestamps

      t.index [ :ai_workflow_id, :key ], unique: true
    end

    create_table :ai_artifacts do |t|
      t.references :ai_workflow_stage, null: false, foreign_key: true
      t.references :subject, polymorphic: true
      t.string :kind, null: false
      t.string :status, null: false, default: "pending"
      t.string :provider
      t.string :model
      t.string :prompt_version
      t.string :source_fingerprint
      t.json :metadata, null: false, default: {}
      t.json :diagnostics, null: false, default: {}
      t.text :error_message
      t.datetime :approved_at
      t.datetime :rejected_at
      t.timestamps

      t.index [ :subject_type, :subject_id, :kind ]
    end
  end
end
