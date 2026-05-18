require "test_helper"

class ClothingItemTest < ActiveSupport::TestCase
  test "fixture clothing item is valid" do
    assert clothing_items(:one).valid?
  end

  test "name is required" do
    item = ClothingItem.new(user: users(:one), size: :small)

    assert_not item.valid?
    assert_includes item.errors[:name], "can't be blank"
  end

  test "belongs to a user" do
    assert_equal users(:one), clothing_items(:one).user
  end

  test "normalizes blank brand to nil" do
    item = ClothingItem.new(
      user: users(:one),
      name: "Basic Tee",
      size: :small,
      brand: "   "
    )

    item.valid?

    assert_nil item.brand
  end

  test "normalizes category to lowercase" do
    item = ClothingItem.new(
      user: users(:one),
      name: "Basic Tee",
      size: :small,
      category: "  Sweater  "
    )

    item.valid?

    assert_equal "sweater", item.category
  end

  test "normalizes tags into a clean list" do
    item = ClothingItem.new(
      user: users(:one),
      name: "Weekend Blazer",
      size: :medium,
      tags: {
        brand: "  COS ",
        vibe: "Workwear",
        duplicate: "cos"
      }
    )

    item.valid?

    assert_equal [ "cos", "workwear" ], item.tags
  end

  test "defaults size to na on create" do
    item = ClothingItem.create!(user: users(:one), name: "Everyday Tee")

    assert_equal "na", item.size
    assert_nil item.date
  end

  test "rejects names longer than the configured maximum" do
    item = ClothingItem.new(
      user: users(:one),
      size: :small,
      name: "x" * (InputLengthPolicy::MAX_CLOTHING_ITEM_NAME + 1)
    )

    assert_not item.valid?
    assert_includes item.errors[:name].first, "too long"
  end

  test "rejects individual tags longer than the configured maximum" do
    item = ClothingItem.new(
      user: users(:one),
      name: "Long Tag Tee",
      size: :small,
      tags: [ "ok", "x" * (InputLengthPolicy::MAX_TAG_LENGTH + 1) ]
    )

    assert_not item.valid?
    assert_includes item.errors[:tags].first, "#{InputLengthPolicy::MAX_TAG_LENGTH} characters"
  end

  test "rejects more than the maximum number of tags" do
    item = ClothingItem.new(
      user: users(:one),
      name: "Way Too Tagged",
      size: :small,
      tags: Array.new(InputLengthPolicy::MAX_TAGS_PER_RECORD + 1) { |i| "tag#{i}" }
    )

    assert_not item.valid?
    assert_includes item.errors[:tags].first, "fewer entries"
  end
end
