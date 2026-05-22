class Outfit < ApplicationRecord
  belongs_to :user
  has_many :outfit_items, -> { order(:layer_order, :id) }, dependent: :destroy, autosave: true
  has_many :clothing_items, through: :outfit_items

  validates :name, presence: true, length: { maximum: InputLengthPolicy::MAX_OUTFIT_NAME }
  validates :notes, length: { maximum: InputLengthPolicy::MAX_OUTFIT_NOTES }, allow_blank: true
  validate :tags_must_be_an_array
  validate :tags_meet_length_policy

  private

  def tags_must_be_an_array
    return if tags.nil? || tags.is_a?(Array)

    errors.add(:tags, "must be an array")
  end

  def tags_meet_length_policy
    InputLengthPolicy.validate_tag_list(self, :tags, tags)
  end
end
