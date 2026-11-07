class CreateOutfitFolders < ActiveRecord::Migration[8.1]
  def change
    create_table :outfit_folders do |table|
      table.references :user, null: false, foreign_key: true
      table.string :name, null: false, limit: 120
      table.string :occasion, limit: 120
      table.text :notes
      table.string :theme, null: false, default: "editorial", limit: 40
      table.timestamps
    end

    create_table :outfit_folder_memberships do |table|
      table.references :outfit_folder, null: false, foreign_key: true
      table.references :outfit, null: false, foreign_key: true
      table.integer :position, null: false, default: 0
      table.timestamps
    end

    add_index :outfit_folder_memberships,
      %i[outfit_folder_id outfit_id],
      unique: true,
      name: "index_outfit_folder_memberships_on_folder_and_outfit"

    create_table :outfit_folder_decorations do |table|
      table.references :outfit_folder, null: false, foreign_key: true
      table.string :page_key, null: false, limit: 80
      table.decimal :x, precision: 7, scale: 3, null: false, default: 8
      table.decimal :y, precision: 7, scale: 3, null: false, default: 8
      table.decimal :width, precision: 7, scale: 3, null: false, default: 20
      table.decimal :rotation, precision: 7, scale: 3, null: false, default: 0
      table.integer :layer_order, null: false, default: 0
      table.timestamps
    end

    add_index :outfit_folder_decorations,
      %i[outfit_folder_id page_key layer_order],
      name: "index_outfit_folder_decorations_on_page_order"
  end
end
