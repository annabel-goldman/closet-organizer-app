class OutfitExperiment < ApplicationRecord
  CAP_USD = BigDecimal("5")
  belongs_to :user
  has_many :outfit_provider_attempts, dependent: :destroy
  validates :name, presence: true, uniqueness: { scope: :user_id }
end
