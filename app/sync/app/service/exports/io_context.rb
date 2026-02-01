require "tempfile"
require "fileutils"
require "zip"

module Exports
  class IoContext
    attr_reader :mode

    PREFIX = "idah-export-"

    def file
      if @mode && @mode != :file
        raise "IoContext is already initialized with #{@mode} mode"
      end

      @mode = :file
      # Create a tempfile

      @file ||= Tempfile.create(PREFIX)
    end

    def directory
      if @mode && @mode != :dir
        raise "IoContext is already initialized with #{@mode} mode"
      end

      @mode = :dir

      @directory ||= begin
        Dir.mktmpdir(PREFIX)
      end
    end

    def zip_directory
      raise "Not in directory mode" unless @mode == :dir
      raise "Directory not created" unless @directory

      zip_path = "#{@directory}.zip"
      Zip::File.open(zip_path, create: true) do |zipfile|
        Dir.glob("#{@directory}/**/*").each do |file|
          zipfile.add(file.sub("#{@directory}/", ""), file)
        end
      end
      zip_path
    end

    def cleanup
      cleanup_file if @file
      cleanup_dir if @directory
    end

    private

    def cleanup_file
      @file.close
    ensure
      File.unlink(@file.path)
      @file = nil
    end

    def cleanup_dir
      FileUtils.rm_rf(@directory)
      @directory = nil
    end
  end
end
