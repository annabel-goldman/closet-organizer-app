class WardrobeImageVersionPublisher
  def self.call(record:, variant_kind:, source:, parent: nil, selected: true, provider: nil, model: nil, metadata: {})
    new(
      record: record,
      variant_kind: variant_kind,
      source: source,
      parent: parent,
      selected: selected,
      provider: provider,
      model: model,
      metadata: metadata
    ).call
  end

  def initialize(record:, variant_kind:, source:, parent:, selected:, provider:, model:, metadata:)
    @record = record
    @variant_kind = variant_kind.to_s
    @source = source
    @parent = parent
    @selected = selected
    @provider = provider
    @model = model
    @metadata = metadata
  end

  def call
    version = record.image_versions.find_or_initialize_by(variant_kind: variant_kind)
    attach(version)
    version.assign_attributes(
      parent: parent,
      provider: provider,
      model: model,
      metadata: metadata
    )
    version.save!
    version.select! if selected
    version
  end

  private

  attr_reader :metadata, :model, :parent, :provider, :record, :selected, :source, :variant_kind

  def attach(version)
    if source.respond_to?(:blob) && source.blob.present?
      version.image.attach(source.blob)
      return
    end

    source_io = source.respond_to?(:tempfile) && source.tempfile ? source.tempfile : source
    source_io.rewind if source_io.respond_to?(:rewind)
    version.image.attach(
      io: source_io,
      filename: source_filename,
      content_type: source_content_type
    )
  end

  def source_filename
    return source.original_filename if source.respond_to?(:original_filename)
    return File.basename(source.path) if source.respond_to?(:path)

    "#{variant_kind}.png"
  end

  def source_content_type
    return source.content_type if source.respond_to?(:content_type) && source.content_type.present?

    "image/png"
  end
end
