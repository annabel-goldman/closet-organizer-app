class CreateWardrobeItemAnalyses < ActiveRecord::Migration[8.0]
  def change
    create_table :wardrobe_item_analyses do |t|
      t.references :clothing_item, null: false, foreign_key: true, index: { unique: true }
      t.string :status, null: false, default: "pending"
      t.string :provider
      t.string :model
      t.string :analysis_version
      t.string :source_fingerprint
      t.string :metadata_fingerprint
      t.json :embedding, null: false, default: []
      t.json :dominant_colors, null: false, default: []
      t.json :attributes, null: false, default: {}
      t.text :error_message
      t.datetime :analyzed_at

      t.timestamps
    end

    add_index :wardrobe_item_analyses, :status
  end
end
