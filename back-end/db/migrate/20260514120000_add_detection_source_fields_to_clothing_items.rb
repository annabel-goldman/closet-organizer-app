class AddDetectionSourceFieldsToClothingItems < ActiveRecord::Migration[8.1]
  def change
    add_column :clothing_items, :source_outfit_upload_id, :integer
    add_column :clothing_items, :source_outfit_detection_id, :integer

    add_index :clothing_items, :source_outfit_upload_id
    add_index :clothing_items, :source_outfit_detection_id
  end
end
