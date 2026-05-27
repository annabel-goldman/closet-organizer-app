class AllowNullCleanImageCutoutFallback < ActiveRecord::Migration[8.1]
  def change
    change_column_null :clothing_items, :clean_image_cutout_fallback, true
    change_column_null :outfit_detections, :clean_image_cutout_fallback, true
  end
end
