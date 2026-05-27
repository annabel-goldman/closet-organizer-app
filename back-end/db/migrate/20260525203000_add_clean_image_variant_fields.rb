class AddCleanImageVariantFields < ActiveRecord::Migration[8.1]
  def change
    add_column :clothing_items, :clean_image_variant, :string
    add_column :clothing_items, :clean_image_cutout_fallback, :boolean, null: false, default: false

    add_column :outfit_detections, :clean_image_variant, :string
    add_column :outfit_detections, :clean_image_cutout_fallback, :boolean, null: false, default: false
  end
end
