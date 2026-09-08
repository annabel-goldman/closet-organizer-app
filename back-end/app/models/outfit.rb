class Outfit < ApplicationRecord
  belongs_to :user
  has_many :outfit_items, -> { order(:layer_order, :id) }, dependent: :destroy, autosave: true
  has_many :clothing_items, through: :outfit_items
  has_many :ai_workflows, as: :subject, dependent: :destroy
  has_many :outfit_folder_memberships, dependent: :destroy
  has_many :outfit_folders, through: :outfit_folder_memberships
  has_many :outfit_decorations, -> { order(:layer_order, :id) }, dependent: :destroy
  has_one :outfit_recommendation_option, dependent: :nullify
  after_commit :invalidate_outfit_preference_profile

  validates :name, presence: true, length: { maximum: InputLengthPolicy::MAX_OUTFIT_NAME }
  validates :notes, length: { maximum: InputLengthPolicy::MAX_OUTFIT_NOTES }, allow_blank: true
  validate :tags_must_be_an_array
  validate :tags_meet_length_policy

  private

  def invalidate_outfit_preference_profile
    user.outfit_preference_profile&.destroy!
    user.association(:outfit_preference_profile).reset
  end

  def tags_must_be_an_array
    return if tags.nil? || tags.is_a?(Array)

    errors.add(:tags, "must be an array")
  end

  def tags_meet_length_policy
    InputLengthPolicy.validate_tag_list(self, :tags, tags)
  end
end
