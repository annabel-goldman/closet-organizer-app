class User < ApplicationRecord
  ALLOWED_GOOGLE_EMAILS = %w[
    annabelgoldman2025@u.northwestern.edu
    annabel.m.goldman@gmail.com
  ].freeze

  class UnauthorizedGoogleEmailError < StandardError; end

  has_secure_password

  has_many :clothing_items, dependent: :destroy
  has_many :outfits, dependent: :destroy
  has_many :outfit_generation_runs, dependent: :destroy
  has_many :outfit_uploads, dependent: :destroy

  validates :username, presence: true, uniqueness: true,
                       length: { maximum: InputLengthPolicy::MAX_USERNAME }
  validates :email, length: { maximum: InputLengthPolicy::MAX_EMAIL }, allow_blank: true
  validates :preferred_style, length: { maximum: InputLengthPolicy::MAX_PREFERRED_STYLE },
                              allow_blank: true
  validates :provider, presence: true
  validates :uid, presence: true, uniqueness: { scope: :provider }

  def self.from_google_auth(auth_hash)
    raise UnauthorizedGoogleEmailError unless google_email_allowed?(auth_hash.info.email)

    user = find_for_google_auth(auth_hash)
    preferred_username = auth_hash.info.name.presence || auth_hash.info.email.presence || "User"

    user.assign_attributes(
      provider: auth_hash.provider,
      uid: auth_hash.uid,
      email: auth_hash.info.email,
      username: resolved_google_username(user, preferred_username),
      avatar_url: auth_hash.info.image
    )

    user.password = SecureRandom.hex(24) if user.new_record?
    user.save!
    user
  end

  def self.find_for_google_auth(auth_hash)
    find_by(provider: auth_hash.provider, uid: auth_hash.uid) ||
      find_by_normalized_email(auth_hash.info.email) ||
      new
  end

  def self.google_email_allowed?(email)
    ALLOWED_GOOGLE_EMAILS.include?(email.to_s.downcase)
  end

  def self.resolved_google_username(user, preferred_username)
    return user.username if user.persisted? && user.username.present?
    return preferred_username unless username_taken?(preferred_username, except_id: user.id)

    suffix = 2

    loop do
      candidate = "#{preferred_username} #{suffix}"
      return candidate unless username_taken?(candidate, except_id: user.id)

      suffix += 1
    end
  end

  def self.find_by_normalized_email(email)
    return if email.blank?

    where("lower(email) = ?", email.to_s.downcase).first
  end

  def self.username_taken?(username, except_id: nil)
    scope = where(username: username)
    scope = scope.where.not(id: except_id) if except_id.present?
    scope.exists?
  end
  private_class_method :find_for_google_auth, :find_by_normalized_email, :resolved_google_username, :username_taken?
end
