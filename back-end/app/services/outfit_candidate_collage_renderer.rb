require "mini_magick"
require "tempfile"

class OutfitCandidateCollageRenderer
  SIZE = 768

  def self.call(items)
    new(items).call
  end

  def initialize(items)
    @items = Array(items).first(6)
  end

  def call
    raise "An outfit candidate needs at least one item." if items.empty?

    tiles = items.each_with_index.map { |item, index| build_tile(item, index) }
    output = Tempfile.new([ "outfit-candidate", ".png" ])
    output.binmode
    compose(tiles, output.path)
    output.rewind
    output
  ensure
    Array(tiles).each(&:close!)
  end

  private

  attr_reader :items

  def build_tile(item, index)
    attachment = item.display_photo_attachment
    raise "#{item.name} does not have an image." unless attachment.attached?

    tile = Tempfile.new([ "outfit-item-#{index}", ".png" ])
    tile.binmode
    attachment.blob.open do |source|
      MiniMagick::Tool.new(command_name) do |command|
        command << source.path
        command.auto_orient
        command.resize "330x220>"
        command.background "white"
        command.gravity "center"
        command.extent "360x238"
        command << tile.path
      end
    end
    tile.rewind
    tile
  end

  def compose(tiles, output_path)
    MiniMagick::Tool.new(command_name) do |command|
      command.size "#{SIZE}x#{SIZE}"
      command << "xc:white"
      tiles.each_with_index do |tile, index|
        x = 12 + ((index % 2) * 378)
        y = 18 + ((index / 2) * 250)
        command << tile.path
        command.geometry "+#{x}+#{y}"
        command.composite
      end
      command << output_path
    end
  end

  def command_name
    MiniMagick.imagemagick7? ? "magick" : "convert"
  end
end
