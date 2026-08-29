class OutfitFolderMembership < ApplicationRecord
  belongs_to :outfit_folder
  belongs_to :outfit

  before_destroy :remove_orphaned_page_decorations

  validates :outfit_id, uniqueness: { scope: :outfit_folder_id }
  validates :position, numericality: { greater_than_or_equal_to: 0, only_integer: true }
  validate :outfit_must_belong_to_folder_user

  private

  def outfit_must_belong_to_folder_user
    return unless outfit_folder && outfit
    return if outfit_folder.user_id == outfit.user_id

    errors.add(:outfit_id, "must belong to the same user as the folder")
  end

  def remove_orphaned_page_decorations
    outfit_folder.decorations.where(page_key: "outfit:#{outfit_id}").destroy_all
  end
end
