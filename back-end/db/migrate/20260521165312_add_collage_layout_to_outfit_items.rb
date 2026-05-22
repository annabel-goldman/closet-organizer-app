class AddCollageLayoutToOutfitItems < ActiveRecord::Migration[8.1]
  def up
    add_column :outfit_items, :collage_x, :float unless column_exists?(:outfit_items, :collage_x)
    add_column :outfit_items, :collage_y, :float unless column_exists?(:outfit_items, :collage_y)
    add_column :outfit_items, :collage_width, :float unless column_exists?(:outfit_items, :collage_width)
    add_column :outfit_items, :collage_height, :float unless column_exists?(:outfit_items, :collage_height)
    unless column_exists?(:outfit_items, :collage_rotation)
      add_column :outfit_items, :collage_rotation, :float, null: false, default: 0.0
    end
    add_column :outfit_items, :layer_order, :integer, null: false, default: 0 unless column_exists?(:outfit_items, :layer_order)

    OutfitItem.reset_column_information

    OutfitItem.all.group_by(&:outfit_id).each_value do |outfit_items|
      outfit_items.sort_by { |outfit_item| [outfit_item.created_at, outfit_item.id] }.each_with_index do |outfit_item, index|
        outfit_item.update_columns(layer_order: index)
      end
    end
  end

  def down
    remove_column :outfit_items, :layer_order if column_exists?(:outfit_items, :layer_order)
    remove_column :outfit_items, :collage_rotation if column_exists?(:outfit_items, :collage_rotation)
    remove_column :outfit_items, :collage_height if column_exists?(:outfit_items, :collage_height)
    remove_column :outfit_items, :collage_width if column_exists?(:outfit_items, :collage_width)
    remove_column :outfit_items, :collage_y if column_exists?(:outfit_items, :collage_y)
    remove_column :outfit_items, :collage_x if column_exists?(:outfit_items, :collage_x)
  end
end
