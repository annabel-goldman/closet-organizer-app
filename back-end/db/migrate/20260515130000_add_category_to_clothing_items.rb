class AddCategoryToClothingItems < ActiveRecord::Migration[8.1]
  def up
    add_column :clothing_items, :category, :string

    execute <<~SQL
      UPDATE clothing_items
      SET category = (
        SELECT outfit_detections.category
        FROM outfit_detections
        WHERE outfit_detections.id = clothing_items.source_outfit_detection_id
      )
      WHERE clothing_items.source_outfit_detection_id IS NOT NULL
        AND (clothing_items.category IS NULL OR clothing_items.category = '');
    SQL
  end

  def down
    remove_column :clothing_items, :category
  end
end
