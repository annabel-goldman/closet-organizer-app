class AddPageLayoutsToOutfitFolders < ActiveRecord::Migration[8.1]
  def change
    add_column :outfit_folders, :page_layouts, :json, default: {}, null: false
  end
end
