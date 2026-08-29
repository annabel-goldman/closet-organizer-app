class OutfitFolder < ApplicationRecord
  belongs_to :user
  has_many :memberships,
    -> { order(:position, :id) },
    class_name: "OutfitFolderMembership",
    dependent: :destroy,
    inverse_of: :outfit_folder
  has_many :outfits, through: :memberships
  has_many :decorations,
    -> { order(:page_key, :layer_order, :id) },
    class_name: "OutfitFolderDecoration",
    dependent: :destroy,
    inverse_of: :outfit_folder

  validates :name, presence: true, length: { maximum: InputLengthPolicy::MAX_OUTFIT_NAME }
  validates :occasion, length: { maximum: InputLengthPolicy::MAX_OUTFIT_NAME }, allow_blank: true
  validates :notes, length: { maximum: InputLengthPolicy::MAX_OUTFIT_NOTES }, allow_blank: true
end
