class CreateWardrobeImageVersions < ActiveRecord::Migration[8.1]
  def change
    create_table :wardrobe_image_versions do |t|
      t.references :imageable, polymorphic: true, null: false
      t.references :parent, foreign_key: { to_table: :wardrobe_image_versions }
      t.string :variant_kind, null: false
      t.boolean :selected, null: false, default: false
      t.string :provider
      t.string :model
      t.json :metadata, null: false, default: {}
      t.timestamps

      t.index [ :imageable_type, :imageable_id, :variant_kind ],
        unique: true,
        name: "index_wardrobe_image_versions_on_owner_and_kind"
      t.index [ :imageable_type, :imageable_id, :selected ],
        name: "index_wardrobe_image_versions_on_owner_and_selected"
    end
  end
end
