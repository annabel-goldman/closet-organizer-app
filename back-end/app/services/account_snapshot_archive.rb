require "json"
require "fileutils"
require "rubygems/package"
require "set"
require "stringio"
require "zlib"

class AccountSnapshotArchive
  Error = Class.new(StandardError)
  MissingManifestError = Class.new(Error)

  LoadedSnapshot = Struct.new(:manifest, :files, keyword_init: true)

  MANIFEST_PATH = "manifest.json"

  class << self
    def write(manifest:, attachment_payloads:, path: nil, io: nil)
      archive_bytes = build_archive_bytes(manifest: manifest, attachment_payloads: attachment_payloads)

      if path.present?
        FileUtils.mkdir_p(File.dirname(path))
        File.binwrite(path, archive_bytes)
      elsif io
        io.binmode if io.respond_to?(:binmode)
        io.write(archive_bytes)
      end

      archive_bytes
    end

    def load(path: nil, io: nil)
      archive_bytes =
        if path.present?
          File.binread(path)
        elsif io
          io.binmode if io.respond_to?(:binmode)
          io.read.to_s.b
        else
          raise Error, "Provide a snapshot archive path or IO."
        end

      read_archive_bytes(archive_bytes)
    end

    private

    def build_archive_bytes(manifest:, attachment_payloads:)
      tar_stream = StringIO.new("".b)
      created_directories = Set.new

      Gem::Package::TarWriter.new(tar_stream) do |tar|
        write_entry(tar, MANIFEST_PATH, JSON.pretty_generate(manifest), created_directories: created_directories)

        attachment_payloads.sort_by(&:first).each do |archive_path, payload|
          write_entry(tar, archive_path, payload, created_directories: created_directories)
        end
      end

      gzip_stream = StringIO.new("".b)
      Zlib::GzipWriter.wrap(gzip_stream) do |gzip|
        gzip.write(tar_stream.string.b)
      end

      gzip_stream.string
    end

    def read_archive_bytes(archive_bytes)
      tar_bytes = Zlib::GzipReader.new(StringIO.new(archive_bytes)).read
      manifest = nil
      files = {}

      Gem::Package::TarReader.new(StringIO.new(tar_bytes)) do |tar|
        tar.each do |entry|
          next unless entry.file?

          entry_bytes = entry.read.to_s.b
          if entry.full_name == MANIFEST_PATH
            manifest = JSON.parse(entry_bytes)
          else
            files[entry.full_name] = entry_bytes
          end
        end
      end

      raise MissingManifestError, "Snapshot archive is missing #{MANIFEST_PATH}." unless manifest

      LoadedSnapshot.new(manifest: manifest, files: files)
    end

    def write_entry(tar, path, bytes, created_directories:)
      payload = bytes.to_s.b
      directory = File.dirname(path)
      if path.include?("/") && directory != "." && created_directories.add?(directory)
        tar.mkdir(directory, 0o755)
      end
      tar.add_file_simple(path, 0o644, payload.bytesize) do |entry_io|
        entry_io.write(payload)
      end
    rescue Gem::Package::TarWriter::FileOverflow
      raise
    rescue StandardError => error
      raise Error, "Unable to add #{path} to snapshot archive: #{error.message}"
    end
  end
end
