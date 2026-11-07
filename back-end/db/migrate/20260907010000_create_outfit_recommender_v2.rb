class CreateOutfitRecommenderV2 < ActiveRecord::Migration[8.0]
  def change
    change_table :wardrobe_item_analyses, bulk: true do |t|
      t.string :enrichment_status, null: false, default: "pending"
      t.string :enrichment_model
      t.string :enrichment_version
      t.string :enrichment_fingerprint
      t.text :enrichment_error_message
      t.datetime :enriched_at
    end
    add_index :wardrobe_item_analyses, :enrichment_status

    create_table :outfit_recommendation_runs do |t|
      t.references :user, null: false, foreign_key: true
      t.references :parent_run, foreign_key: { to_table: :outfit_recommendation_runs }
      t.string :status, null: false, default: "pending"
      t.text :prompt, null: false
      t.json :structured_brief, null: false, default: {}
      t.json :constraints, null: false, default: {}
      t.json :candidate_item_sets, null: false, default: []
      t.json :judge_rubric, null: false, default: {}
      t.json :models, null: false, default: {}
      t.json :usage, null: false, default: {}
      t.text :result_message
      t.text :error_message
      t.datetime :completed_at

      t.timestamps
    end
    add_index :outfit_recommendation_runs, :status

    create_table :outfit_recommendation_options do |t|
      t.references :outfit_recommendation_run, null: false, foreign_key: true,
        index: { name: "idx_recommendation_options_on_run" }
      t.references :outfit, foreign_key: true
      t.integer :rank
      t.string :status, null: false, default: "candidate"
      t.string :title
      t.text :summary
      t.json :clothing_item_ids, null: false, default: []
      t.decimal :local_score, precision: 7, scale: 3
      t.decimal :judge_score, precision: 7, scale: 3
      t.json :judge_scores, null: false, default: {}
      t.json :reasons, null: false, default: []
      t.json :hard_violations, null: false, default: []

      t.timestamps
    end
    add_index :outfit_recommendation_options,
      %i[outfit_recommendation_run_id rank],
      unique: true,
      name: "idx_recommendation_options_run_rank"

    create_table :outfit_recommendation_feedback_events do |t|
      t.references :user, null: false, foreign_key: true
      t.references :outfit_recommendation_run, null: false, foreign_key: true,
        index: { name: "idx_recommendation_feedback_on_run" }
      t.references :outfit_recommendation_option, foreign_key: true,
        index: { name: "idx_recommendation_feedback_on_option" }
      t.references :clothing_item, foreign_key: true
      t.string :event_type, null: false
      t.json :metadata, null: false, default: {}

      t.timestamps
    end
    add_index :outfit_recommendation_feedback_events, :event_type

    create_table :outfit_preference_profiles do |t|
      t.references :user, null: false, foreign_key: true, index: { unique: true }
      t.json :profile_data, null: false, default: {}
      t.string :version, null: false
      t.datetime :rebuilt_at

      t.timestamps
    end
  end
end
