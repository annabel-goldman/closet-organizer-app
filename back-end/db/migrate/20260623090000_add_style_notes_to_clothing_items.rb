class AddStyleNotesToClothingItems < ActiveRecord::Migration[8.1]
  def change
    add_column :clothing_items, :style_notes, :text
  end
end
