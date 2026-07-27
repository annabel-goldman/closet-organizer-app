class CreateOutfitGenerationFeedback < ActiveRecord::Migration[8.1]
  def change
    create_table :outfit_generation_runs do |t|
      t.references :user, null: false, foreign_key: true
      t.references :outfit, null: true, foreign_key: { on_delete: :nullify }
      t.string :occasion
      t.json :reference_profile
      t.json :candidate_item_ids, null: false, default: []
      t.json :generated_item_ids, null: false, default: []
      t.string :generator_version, null: false
      t.datetime :generated_at, null: false

      t.timestamps
    end

    add_index :outfit_generation_runs, :generated_at

    create_table :outfit_generation_events do |t|
      t.references :outfit_generation_run, null: false, foreign_key: true, index: { name: "index_outfit_generation_events_on_run_id" }
      t.string :event_type, null: false
      t.json :final_item_ids, null: false, default: []
      t.json :added_item_ids, null: false, default: []
      t.json :removed_item_ids, null: false, default: []
      t.json :kept_item_ids, null: false, default: []

      t.timestamps
    end

    add_index :outfit_generation_events, :event_type
    add_index :outfit_generation_events, :created_at
  end
end
