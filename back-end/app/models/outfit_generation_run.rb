class OutfitGenerationRun < ApplicationRecord
  EVENT_GENERATED = "generated".freeze
  EVENT_OPENED_FOR_EDIT = "opened_for_edit".freeze
  EVENT_SAVED_UNCHANGED = "saved_unchanged".freeze
  EVENT_SAVED_WITH_ITEM_CHANGES = "saved_with_item_changes".freeze
  EVENT_DELETED = "deleted".freeze

  belongs_to :user
  belongs_to :outfit, optional: true
  has_many :outfit_generation_events, dependent: :destroy

  validates :generator_version, presence: true
  validates :generated_at, presence: true
  validate :candidate_item_ids_must_be_an_array
  validate :generated_item_ids_must_be_an_array

  def record_generated!
    record_event!(EVENT_GENERATED, final_item_ids: generated_item_ids)
  end

  def record_opened_for_edit!
    record_event!(EVENT_OPENED_FOR_EDIT, final_item_ids: generated_item_ids)
  end

  def record_save_event!(final_item_ids:)
    normalized_final_ids = normalize_item_ids(final_item_ids)
    normalized_generated_ids = normalize_item_ids(generated_item_ids)
    added_item_ids = normalized_final_ids - normalized_generated_ids
    removed_item_ids = normalized_generated_ids - normalized_final_ids
    kept_item_ids = normalized_final_ids & normalized_generated_ids
    event_type = added_item_ids.empty? && removed_item_ids.empty? ? EVENT_SAVED_UNCHANGED : EVENT_SAVED_WITH_ITEM_CHANGES

    record_event!(
      event_type,
      final_item_ids: normalized_final_ids,
      added_item_ids: added_item_ids,
      removed_item_ids: removed_item_ids,
      kept_item_ids: kept_item_ids
    )
  end

  def record_deleted!
    record_event!(EVENT_DELETED, final_item_ids: normalize_item_ids(outfit&.clothing_item_ids || generated_item_ids))
  end

  private

  def record_event!(event_type, final_item_ids:, added_item_ids: [], removed_item_ids: [], kept_item_ids: [])
    outfit_generation_events.create!(
      event_type: event_type,
      final_item_ids: normalize_item_ids(final_item_ids),
      added_item_ids: normalize_item_ids(added_item_ids),
      removed_item_ids: normalize_item_ids(removed_item_ids),
      kept_item_ids: normalize_item_ids(kept_item_ids)
    )
  end

  def normalize_item_ids(value)
    Array(value).filter_map do |item_id|
      Integer(item_id)
    rescue ArgumentError, TypeError
      nil
    end.uniq
  end

  def candidate_item_ids_must_be_an_array
    errors.add(:candidate_item_ids, "must be an array") unless candidate_item_ids.is_a?(Array)
  end

  def generated_item_ids_must_be_an_array
    errors.add(:generated_item_ids, "must be an array") unless generated_item_ids.is_a?(Array)
  end
end
