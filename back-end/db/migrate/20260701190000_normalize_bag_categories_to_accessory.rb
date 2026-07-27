class NormalizeBagCategoriesToAccessory < ActiveRecord::Migration[8.1]
  def up
    execute <<~SQL.squish
      UPDATE clothing_items
      SET category = 'accessory'
      WHERE lower(category) = 'bag'
    SQL
  end

  def down
    # Irreversible: existing bag-like items should remain grouped as accessories.
  end
end
