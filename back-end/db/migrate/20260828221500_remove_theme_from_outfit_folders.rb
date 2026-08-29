class RemoveThemeFromOutfitFolders < ActiveRecord::Migration[8.1]
  def change
    remove_column :outfit_folders, :theme, :string
  end
end
