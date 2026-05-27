require "test_helper"

class TransparentPngVariantGeneratorTest < ActiveSupport::TestCase
  test "returns the generated transparent png even when the cutout would have been considered suspicious before" do
    original = CleanImageBackgroundRemover.method(:call)
    source_file = Tempfile.new([ "cleaned-item", ".png" ])
    source_file.binmode
    source_file.write(File.binread(file_fixture("item-photo.png")))
    source_file.rewind

    CleanImageBackgroundRemover.singleton_class.send(:define_method, :call) do |_image_source, filename_root:, temporary_files: []|
      tempfile = ManagedTempfiles.wrap(temporary_files).track(
        Tempfile.new([ "#{filename_root}-transparent", ".png" ])
      )
      tempfile.binmode
      MiniMagick::Tool.new(MiniMagick.imagemagick7? ? "magick" : "convert") do |command|
        command.size "1x1"
        command.xc "none"
        command << tempfile.path
      end
      tempfile.rewind

      {
        tempfile: tempfile,
        filename: "#{filename_root}-transparent.png",
        content_type: "image/png"
      }
    end

    result = TransparentPngVariantGenerator.call(
      source_file,
      filename_root: "cleaned-item"
    )

    assert_equal "transparent", result[:image_variant]
    assert_equal false, result[:cutout_fallback]
    assert_equal "cleaned-item-transparent.png", result[:filename]
  ensure
    CleanImageBackgroundRemover.singleton_class.send(:define_method, :call, original)
    source_file.close!
  end

  test "can generate a transparent png from an Active Storage attachment" do
    original = CleanImageBackgroundRemover.method(:call)
    fixture_path = file_fixture("item-photo.png")
    item = ClothingItem.create!(
      user: users(:one),
      name: "Attachment Source Item",
      size: "small",
      tags: []
    )
    item.cleaned_photo.attach(
      Rack::Test::UploadedFile.new(file_fixture("item-photo.png"), "image/png")
    )

    seen_source_path = nil

    CleanImageBackgroundRemover.singleton_class.send(:define_method, :call) do |image_source, filename_root:, temporary_files: []|
      seen_source_path = image_source.path
      tempfile = ManagedTempfiles.wrap(temporary_files).track(
        Tempfile.new([ "#{filename_root}-transparent", ".png" ])
      )
      tempfile.binmode
      tempfile.write(File.binread(fixture_path))
      tempfile.rewind

      {
        tempfile: tempfile,
        filename: "#{filename_root}-transparent.png",
        content_type: "image/png"
      }
    end

    result = TransparentPngVariantGenerator.call(
      item.cleaned_photo,
      filename_root: "attachment-item"
    )

    assert_equal "transparent", result[:image_variant]
    assert_equal "attachment-item-transparent.png", result[:filename]
    assert_predicate seen_source_path, :present?
  ensure
    CleanImageBackgroundRemover.singleton_class.send(:define_method, :call, original)
  end
end
