class CreateModelReferenceImages < ActiveRecord::Migration[8.1]
  class MigrationModelReferenceImage < ActiveRecord::Base
    self.table_name = "model_reference_images"
  end

  class MigrationActiveStorageAttachment < ActiveRecord::Base
    self.table_name = "active_storage_attachments"
  end

  def up
    create_table :model_reference_images do |t|
      t.references :user, null: false, foreign_key: true
      t.integer :position, null: false

      t.timestamps
    end
    add_index :model_reference_images, %i[user_id position], unique: true

    MigrationModelReferenceImage.reset_column_information
    positions_by_user_id = Hash.new(0)

    MigrationActiveStorageAttachment
      .where(record_type: "User", name: "model_reference_photo")
      .order(:id)
      .find_each do |attachment|
        user_id = attachment.record_id
        position = positions_by_user_id[user_id]
        reference = MigrationModelReferenceImage.create!(
          user_id: user_id,
          position: position,
          created_at: attachment.created_at,
          updated_at: attachment.created_at
        )

        attachment.update_columns(
          record_type: "ModelReferenceImage",
          record_id: reference.id,
          name: "photo"
        )
        positions_by_user_id[user_id] = position + 1
      end
  end

  def down
    raise ActiveRecord::IrreversibleMigration, "Model reference image collections cannot be safely collapsed to one attachment."
  end
end
