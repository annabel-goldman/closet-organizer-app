# frozen_string_literal: true

class AddBrandToClothingItems < ActiveRecord::Migration[8.1]
  def change
    add_column :clothing_items, :brand, :string
  end
end
