require "tempfile"
require "fileutils"

module Export
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