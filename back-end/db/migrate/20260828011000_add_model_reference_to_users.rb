class AddModelReferenceToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :model_reference_consent_at, :datetime
  end
end
