require "mini_magick"
require "tempfile"

class OutfitCandidateCollageRenderer
  SIZE = 768

  def self.call(items)
    new(items).call
  end

  def initialize(items)
    @items = Array(items)
    raise "Too many pieces for a readable collage." if @items.length > 16
  end

  def call
    raise "An outfit candidate needs at least one item." if items.empty?

    tiles = []
    items.each_with_index { |item, index| tiles << build_tile(item, index) }
    output = Tempfile.new([ "outfit-candidate", ".png" ])
    output.binmode
    compose(tiles, output.path)
    output.rewind
    output
  rescue StandardError
    output&.close!
    raise
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
        command.resize "#{cell - 24}x#{cell - 40}>"
        command.background "white"
        command.alpha "remove"
        command.alpha "off"
        command.gravity "center"
        command.extent "#{cell}x#{cell}"
        command << tile.path
      end
    end
    tile.rewind
    tile
  rescue StandardError
    tile&.close!
    raise
  end

  def compose(tiles, output_path)
    MiniMagick::Tool.new(command_name) do |command|
      command.size "#{SIZE}x#{SIZE}"
      command << "xc:white"
      tiles.each_with_index do |tile, index|
        x = (index % columns) * cell
        y = (index / columns) * cell
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

  def columns
    Math.sqrt(items.length).ceil
  end

  def cell
    SIZE / columns
  end
end
