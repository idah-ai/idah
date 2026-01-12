module Command
  class Cvat < Base
    attr_reader :zip_command
    def initialize(**opts)
      filename = opts.dig(:filename) || [
        "export.cvat.bundle", Time.now.to_i
      ].join(".")
      FileUtils.mkdir_p filename
      @zip_command = Command::ZipCommand.new(filename: filename)
      super(**opts.merge(filename:))
    end

    def xml(resource, &block)
      directory = File.join(filename, resource)
      FileUtils.mkdir_p directory
      FileUtils.mkdir_p [directory, :images].join("/")
      xml_command = Command::XmlBuilder.new(filename: File.join(directory, 'annotations.xml'))
      yield xml_command.builder
      zip_command.zip("**.*", zipname: resource)
      FileUtils.rm_rf(directory)
    end

    def zip(*path, zipname: nil)
      zip_command.zip(*path, zipname:)
    end

    def close
      FileUtils.rm_rf(filename)
    end
  end
end
