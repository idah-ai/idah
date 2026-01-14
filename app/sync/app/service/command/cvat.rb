require 'builder'
require 'zip'

module Command
  class Cvat < Base
    def initialize(name: nil, **opts)
      filename = [
        name || "export.#{Time.now.to_i}.cvat.tasks",
        :zip
      ].join(".")
      super(**opts.merge(filename:))
    end

    def build_dir
      File.basename(filename, File.extname(filename))
    end

    def mkdir(path)
      FileUtils.mkdir_p(File.join(build_dir, path))
    end

    def rmdir(path = nil)
      # maybe not rm_rf :sweat_smile # or should be contained
      if path
        FileUtils.rm_rf(File.join(build_dir, path))
      else
        FileUtils.rm_rf(build_dir)
      end
    end

    def xml(name, &block)
      builder = Builder::XmlMarkup.new(
        :target => File.new(File.join(build_dir, name), 'w'),
        :indent => 2
      )
      builder.instruct! :xml, :version=>"1.0", :encoding=>"UTF-8"
      yield builder
    end

    def zip(match = nil, path = nil)
      match ||= ["**", "**"]
      output = if path
        File.join(build_dir, path) + ".zip"
      else
        filename
      end
      ignored_path = if path
        File.join(build_dir, path)
      else
        build_dir
      end

      Zip::File.open(output, create: true) do |zip|
        Dir.glob(File.join(ignored_path, match)).each do |file_path|
          path_in_zip = file_path.sub(/^#{Regexp.escape(ignored_path)}\/?/, '')
          return path_in_zip if path_in_zip.empty?

          if File.directory?(file_path)
            zip.mkdir(path_in_zip) unless zip.find_entry(path_in_zip)
          else
            zip.add(path_in_zip, file_path)
          end
        end
      end
    end

    def close
      rmdir # remove any mkdir based directory
    end
  end
end
