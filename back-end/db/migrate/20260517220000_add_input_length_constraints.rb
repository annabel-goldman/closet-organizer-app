class AddInputLengthConstraints < ActiveRecord::Migration[8.1]
  def up
    backfill_clothing_item_defaults
    backfill_user_defaults
    backfill_outfit_defaults

    change_column :users, :username, :string, limit: 60, null: false
    change_column :users, :email, :string, limit: 254
    change_column :users, :preferred_style, :string, limit: 40
    change_column :users, :provider, :string, limit: 60, null: false
    change_column :users, :uid, :string, limit: 255, null: false

    change_column :clothing_items, :name, :string, limit: 120, null: false
    change_column :clothing_items, :brand, :string, limit: 80
    change_column :clothing_items, :category, :string, limit: 60

    change_column :outfits, :name, :string, limit: 120, null: false
  end

  def down
    change_column :users, :username, :string
    change_column :users, :email, :string
    change_column :users, :preferred_style, :string
    change_column :users, :provider, :string
    change_column :users, :uid, :string

    change_column :clothing_items, :name, :string
    change_column :clothing_items, :brand, :string
    change_column :clothing_items, :category, :string

    change_column :outfits, :name, :string
  end

  private

  def backfill_clothing_item_defaults
    execute "UPDATE clothing_items SET name = 'Unnamed item' WHERE name IS NULL OR name = ''"
  end

  def backfill_user_defaults
    execute "UPDATE users SET username = 'user_' || id WHERE username IS NULL OR username = ''"
    execute "UPDATE users SET provider = 'unknown' WHERE provider IS NULL OR provider = ''"
    execute "UPDATE users SET uid = 'legacy-' || id WHERE uid IS NULL OR uid = ''"
  end

  def backfill_outfit_defaults
    execute "UPDATE outfits SET name = 'Untitled outfit' WHERE name IS NULL OR name = ''"
  end
end
