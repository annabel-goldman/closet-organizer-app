class ManagedTempfiles
  def self.wrap(tempfiles = nil)
    return tempfiles if tempfiles.is_a?(self)

    new(Array(tempfiles))
  end

  def initialize(files = [])
    @files = files
    @closed = false
  end

  def track(file)
    file.rewind if file.respond_to?(:rewind)
    files << file
    file
  end

  def close_all
    return if @closed

    files.each do |file|
      file.close! if file.respond_to?(:close!)
    end

    files.clear
    @closed = true
  end

  private

  attr_reader :files
end
