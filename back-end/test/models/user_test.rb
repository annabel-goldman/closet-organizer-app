require "test_helper"
require "ostruct"

class UserTest < ActiveSupport::TestCase
  test "fixture user is valid" do
    assert users(:one).valid?
  end

  test "username is required" do
    user = User.new(password: "password123", password_confirmation: "password123")

    assert_not user.valid?
    assert_includes user.errors[:username], "can't be blank"
  end

  test "authenticate works with fixture password" do
    assert users(:one).authenticate("password123")
  end

  test "google auth assigns a unique username when display name already exists" do
    User.create!(
      username: "Annabel Goldman",
      email: "existing@example.com",
      provider: "google_oauth2",
      uid: "existing-google-user",
      password: "password123"
    )

    auth_hash = OpenStruct.new(
      provider: "google_oauth2",
      uid: "new-google-user",
      info: OpenStruct.new(
        email: "annabel.m.goldman@gmail.com",
        name: "Annabel Goldman",
        image: "https://example.com/avatar.png"
      )
    )

    user = User.from_google_auth(auth_hash)

    assert_equal "Annabel Goldman 2", user.username
    assert_equal "annabel.m.goldman@gmail.com", user.email
  end

  test "google auth reuses the same user without renaming on repeat sign in" do
    auth_hash = OpenStruct.new(
      provider: "google_oauth2",
      uid: users(:one).uid,
      info: OpenStruct.new(
        email: "annabel.m.goldman@gmail.com",
        name: "Alex Renamed",
        image: "https://example.com/alex.png"
      )
    )

    user = User.from_google_auth(auth_hash)

    assert_equal users(:one).id, user.id
    assert_equal "alex", user.username
    assert_equal "annabel.m.goldman@gmail.com", user.email
  end

  test "google auth reuses an existing user with the same email" do
    seeded_user = User.create!(
      username: "annabel_goldman",
      email: "annabelgoldman2025@u.northwestern.edu",
      provider: "google_oauth2",
      uid: "seed-annabel-goldman",
      admin: true,
      password: "password123"
    )

    auth_hash = OpenStruct.new(
      provider: "google_oauth2",
      uid: "real-google-uid-123",
      info: OpenStruct.new(
        email: "annabelgoldman2025@u.northwestern.edu",
        name: "Annabel Goldman",
        image: "https://example.com/annabel.png"
      )
    )

    user = User.from_google_auth(auth_hash)

    assert_equal seeded_user.id, user.id
    assert_equal "annabel_goldman", user.username
    assert_equal "real-google-uid-123", user.uid
    assert user.admin?
  end

  test "google auth reuses an existing user with the same email regardless of case" do
    seeded_user = User.create!(
      username: "annabel_goldman_case",
      email: "annabelgoldman2025@u.northwestern.edu",
      provider: "google_oauth2",
      uid: "seed-annabel-goldman-case",
      admin: true,
      password: "password123"
    )

    auth_hash = OpenStruct.new(
      provider: "google_oauth2",
      uid: "real-google-uid-456",
      info: OpenStruct.new(
        email: "ANNABELGOLDMAN2025@u.northwestern.edu",
        name: "Annabel Goldman",
        image: "https://example.com/annabel.png"
      )
    )

    user = User.from_google_auth(auth_hash)

    assert_equal seeded_user.id, user.id
    assert_equal "real-google-uid-456", user.uid
  end

  test "google auth rejects unapproved email addresses" do
    auth_hash = OpenStruct.new(
      provider: "google_oauth2",
      uid: "unapproved-google-user",
      info: OpenStruct.new(
        email: "not-annabel@example.com",
        name: "Not Annabel",
        image: "https://example.com/not-annabel.png"
      )
    )

    assert_no_difference "User.count" do
      assert_raises(User::UnauthorizedGoogleEmailError) do
        User.from_google_auth(auth_hash)
      end
    end
  end
end
