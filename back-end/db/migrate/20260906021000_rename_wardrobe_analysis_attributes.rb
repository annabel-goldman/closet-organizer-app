class RenameWardrobeAnalysisAttributes < ActiveRecord::Migration[8.0]
  def change
    rename_column :wardrobe_item_analyses, :attributes, :extracted_attributes
  end
end
