class OutfitPreferenceProfile < ApplicationRecord
  CURRENT_VERSION = "outfit-preferences-v2".freeze

  belongs_to :user

  validates :user_id, uniqueness: true
  validates :version, presence: true
end
