class OutfitGenerationEvent < ApplicationRecord
  EVENT_TYPES = [
    OutfitGenerationRun::EVENT_GENERATED,
    OutfitGenerationRun::EVENT_OPENED_FOR_EDIT,
    OutfitGenerationRun::EVENT_SAVED_UNCHANGED,
    OutfitGenerationRun::EVENT_SAVED_WITH_ITEM_CHANGES,
    OutfitGenerationRun::EVENT_DELETED
  ].freeze

  belongs_to :outfit_generation_run

  validates :event_type, presence: true, inclusion: { in: EVENT_TYPES }
  validate :item_id_payloads_must_be_arrays

  private

  def item_id_payloads_must_be_arrays
    %i[final_item_ids added_item_ids removed_item_ids kept_item_ids].each do |attribute|
      errors.add(attribute, "must be an array") unless public_send(attribute).is_a?(Array)
    end
  end
end
