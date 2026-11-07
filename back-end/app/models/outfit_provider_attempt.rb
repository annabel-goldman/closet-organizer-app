class OutfitProviderAttempt < ApplicationRecord
  belongs_to :outfit_experiment, optional: true
  belongs_to :outfit_recommendation_run, optional: true
end
