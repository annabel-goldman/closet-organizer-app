require "test_helper"
require "stringio"

class UserClothingItemPngBackfillTest < ActiveSupport::TestCase
  setup do
    @user = users(:one)
    @other_user = users(:two)
  end

  test "processes only the target user's original clothing item photos and skips already cleaned items by default" do
    target_item = clothing_items(:one)
    target_item.photo.attach(item_photo_upload_png)

    source_upload = OutfitUpload.new(user: @user, status: :succeeded, provider: "openrouter")
    source_upload.source_photo.attach(item_photo_upload_png)
    source_upload.save!
    target_item.update!(source_outfit_upload_id: source_upload.id)

    already_cleaned_item = ClothingItem.create!(
      user: @user,
      name: "Already Clean",
      size: :medium,
      tags: [ "done" ]
    )
    already_cleaned_item.photo.attach(item_photo_upload_png)
    already_cleaned_item.cleaned_photo.attach(item_photo_upload_png)

    ClothingItem.create!(
      user: @user,
      name: "No Photo",
      size: :medium,
      tags: [ "skip" ]
    )

    other_item = clothing_items(:two)
    other_item.photo.attach(item_photo_upload_png)

    calls = []

    with_clean_image_attachment_generator_stub(calls: calls) do
      summary = UserClothingItemPngBackfill.new(email: @user.email).call

      assert_equal @user.email, summary[:email]
      assert_equal 3, summary[:total_items]
      assert_equal 1, summary[:processed]
      assert_equal 1, summary[:skipped_already_cleaned]
      assert_equal 1, summary[:skipped_without_source_photo]
      assert_equal 0, summary[:failed]
    end

    assert_equal 1, calls.size
    assert_equal target_item.id, calls.first[:record_id]
    assert_equal target_item.photo.blob.id, calls.first[:source_photo_blob_id]
    assert_equal [ source_upload.source_photo.blob.id ], calls.first[:reference_photo_blob_ids]
    assert_equal target_item.name, calls.first.dig(:metadata_context, :name)
    assert_predicate target_item.reload.cleaned_photo, :attached?
    assert_not other_item.reload.cleaned_photo.attached?
  end

  test "force rerun still uses the original item photo when a cleaned photo already exists" do
    item = clothing_items(:one)
    item.photo.attach(item_photo_upload_png)
    item.cleaned_photo.attach(item_photo_upload_png)
    item.update!(
      clean_image_status: :succeeded,
      clean_image_error_message: "old error",
      clean_image_provider: "old-provider",
      clean_image_model: "old-model",
      clean_image_generated_at: 1.day.ago
    )

    calls = []

    with_clean_image_attachment_generator_stub(calls: calls) do
      summary = UserClothingItemPngBackfill.new(email: @user.email, force: true).call

      assert_equal 1, summary[:processed]
      assert_equal 0, summary[:skipped_already_cleaned]
      assert_equal 0, summary[:failed]
    end

    assert_equal 1, calls.size
    assert_equal item.id, calls.first[:record_id]
    assert_equal item.photo.blob.id, calls.first[:source_photo_blob_id]
  end

  test "records failures and continues with later items" do
    failing_item = clothing_items(:one)
    failing_item.photo.attach(item_photo_upload_png)

    succeeding_item = ClothingItem.create!(
      user: @user,
      name: "Second Item",
      size: :medium,
      tags: [ "processed" ]
    )
    succeeding_item.photo.attach(item_photo_upload_png)

    with_clean_image_attachment_generator_stub(failing_record_ids: [ failing_item.id ]) do
      summary = UserClothingItemPngBackfill.new(email: @user.email).call

      assert_equal 1, summary[:processed]
      assert_equal 1, summary[:failed]
      assert_equal failing_item.id, summary[:failures].first[:item_id]
      assert_match(/stubbed cleaner failure/, summary[:failures].first[:error])
    end

    assert_not failing_item.reload.cleaned_photo.attached?
    assert_predicate succeeding_item.reload.cleaned_photo, :attached?
  end

  test "can limit png backfill to a specific set of item ids" do
    included_item = clothing_items(:one)
    included_item.photo.attach(item_photo_upload_png)

    excluded_item = ClothingItem.create!(
      user: @user,
      name: "Leave Me Alone",
      size: :medium,
      tags: [ "excluded" ]
    )
    excluded_item.photo.attach(item_photo_upload_png)

    calls = []

    with_clean_image_attachment_generator_stub(calls: calls) do
      summary = UserClothingItemPngBackfill.new(
        email: @user.email,
        item_ids: [ included_item.id ]
      ).call

      assert_equal 1, summary[:total_items]
      assert_equal 1, summary[:processed]
      assert_equal 0, summary[:failed]
    end

    assert_equal [ included_item.id ], calls.map { |call| call[:record_id] }
    assert_predicate included_item.reload.cleaned_photo, :attached?
    assert_not excluded_item.reload.cleaned_photo.attached?
  end

  private

  def item_photo_upload_png
    Rack::Test::UploadedFile.new(file_fixture("item-photo.png"), "image/png")
  end

  def with_clean_image_attachment_generator_stub(calls: [], failing_record_ids: [])
    original = CleanImageAttachmentGenerator.method(:call)
    fixture_path = file_fixture("item-photo.png")

    CleanImageAttachmentGenerator.singleton_class.send(:define_method, :call) do |record:, source_photo:, prompt_context:, temporary_files: [], reference_photos: [], metadata_context: {}|
      if failing_record_ids.include?(record.id)
        raise "stubbed cleaner failure for item ##{record.id}"
      end

      calls << {
        record_id: record.id,
        source_photo_blob_id: source_photo.respond_to?(:blob) ? source_photo.blob.id : nil,
        reference_photo_blob_ids: reference_photos.filter_map { |photo| photo.respond_to?(:blob) ? photo.blob.id : nil },
        prompt_context: prompt_context,
        metadata_context: metadata_context,
        temporary_files_count: Array(temporary_files).size
      }

      record.cleaned_photo.attach(
        io: StringIO.new(File.binread(fixture_path)),
        filename: "generated-clean.png",
        content_type: "image/png"
      )
      record.update!(
        clean_image_status: :succeeded,
        clean_image_error_message: nil,
        clean_image_provider: "openrouter",
        clean_image_model: "google/gemini-2.5-flash-image",
        clean_image_generated_at: Time.current
      )
    end

    yield
  ensure
    CleanImageAttachmentGenerator.singleton_class.send(:define_method, :call, original)
  end
end
