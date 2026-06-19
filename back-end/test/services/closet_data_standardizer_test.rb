require "test_helper"

class ClosetDataStandardizerTest < ActiveSupport::TestCase
  test "dry run reports changes without mutating records" do
    user = create_annabel_user
    item = legacy_item_for(user)

    result = ClosetDataStandardizer.new(email: user.email, apply: false).call
    audit = result.audits.find { |entry| entry.id == item.id }

    assert_equal false, result.apply
    assert_nil result.backup_path
    assert audit.changed?
    assert_equal "top", audit.new_category
    assert_equal "J.Crew", audit.new_brand
    assert_equal "Navy Knit Polo Sweater", audit.new_name
    assert_equal [ "crew neck", "wide-leg", "sweater" ], audit.new_tags

    item.reload
    assert_equal "sweater", item.category
    assert_equal "J-crew", item.brand
    assert_equal "Navy Knit Polo Aweater", item.name
    assert_equal [ "crewneck", "top", "wide leg" ], item.tags
  end

  test "apply mode updates only the requested account and creates a sqlite backup" do
    user = create_annabel_user
    other_user = User.create!(
      username: "other-cleanup-user",
      email: "other-cleanup@example.com",
      provider: "google_oauth2",
      uid: "other-cleanup-user",
      password: "password123"
    )
    item = legacy_item_for(user)
    other_item = legacy_item_for(other_user, name: "Other Knit Polo Aweater")

    result = ClosetDataStandardizer.new(email: user.email, apply: true).call

    assert_equal true, result.apply
    assert result.backup_path.present?
    assert File.exist?(result.backup_path)

    item.reload
    assert_equal "top", item.category
    assert_equal "J.Crew", item.brand
    assert_equal "Navy Knit Polo Sweater", item.name
    assert_equal [ "crew neck", "wide-leg", "sweater" ], item.tags

    other_item.reload
    assert_equal "sweater", other_item.category
    assert_equal "J-crew", other_item.brand
    assert_equal "Other Knit Polo Aweater", other_item.name
  ensure
    FileUtils.rm_f(result.backup_path) if defined?(result) && result&.backup_path.present?
  end

  private

  def create_annabel_user
    User.create!(
      username: "annabel-cleanup",
      email: ClosetDataStandardizer::DEFAULT_EMAIL,
      provider: "google_oauth2",
      uid: "annabel-cleanup",
      password: "password123"
    )
  end

  def legacy_item_for(user, name: "Navy Knit Polo Aweater")
    item = user.clothing_items.create!(
      name: "Temporary Item",
      category: "top",
      brand: "Temp",
      size: :na,
      tags: []
    )

    item.update_columns(
      name: name,
      category: "sweater",
      brand: "J-crew",
      tags: [ "crewneck", "top", "wide leg" ]
    )

    item
  end
end
