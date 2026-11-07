class AddOutfitExperiments < ActiveRecord::Migration[8.1]
  def change
    create_table :outfit_experiments do |t|
      t.references :user, null: false, foreign_key: true
      t.string :name, null: false
      t.decimal :reserved_usd, precision: 12, scale: 8, null: false, default: 0
      t.json :manifest, null: false, default: {}
      t.timestamps
    end
    add_index :outfit_experiments, [ :user_id, :name ], unique: true
    create_table :outfit_provider_attempts do |t|
      t.references :outfit_experiment, foreign_key: true
      t.references :outfit_recommendation_run, foreign_key: true
      t.string :model, null: false
      t.string :endpoint, null: false
      t.string :status, null: false, default: "reserved"
      t.decimal :reserved_usd, precision: 12, scale: 8, null: false
      t.json :usage, null: false, default: {}
      t.text :error_message
      t.integer :latency_ms
      t.timestamps
    end
    create_table :outfit_example_descriptions do |t|
      t.references :outfit, null: false, foreign_key: { on_delete: :cascade }, index: { unique: true }
      t.string :fingerprint, null: false
      t.json :description, null: false, default: {}
      t.timestamps
    end
  end
end
