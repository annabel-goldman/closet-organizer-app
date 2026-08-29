class CreateDecorationsAndOutfitDecorations < ActiveRecord::Migration[8.0]
  def change
    create_table :decorations do |t|
      t.references :user, null: false, foreign_key: true
      t.string :name, null: false

      t.timestamps
    end

    create_table :outfit_decorations do |t|
      t.references :outfit, null: false, foreign_key: true
      t.references :decoration, null: false, foreign_key: true
      t.decimal :x, precision: 6, scale: 2, null: false, default: 35
      t.decimal :y, precision: 6, scale: 2, null: false, default: 35
      t.decimal :width, precision: 6, scale: 2, null: false, default: 20
      t.decimal :rotation, precision: 6, scale: 2, null: false, default: 0
      t.integer :layer_order, null: false, default: 0

      t.timestamps
    end

    add_reference :outfit_folder_decorations, :decoration, null: true, foreign_key: true
  end
end
