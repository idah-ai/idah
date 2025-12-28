require 'builder'
require 'zip'

module ExecutorCommand
  module CvatVideo
    Context = Data.define(:name, :filename, :i, :o, :e) do
      def builder(resource, &block)
        directory = [
          filename,
          resource
        ].join("/")
        FileUtils.mkdir_p directory
        FileUtils.mkdir_p [directory, :images].join("/")
        file = File.new([directory, 'annotations.xml'].join("/"), 'w')
        xml_markup = Builder::XmlMarkup.new(
          :target => file,
          :indent => 2
        )
        xml_markup.instruct! :xml, :version=>"1.0", :encoding=>"UTF-8"
        yield xml_markup

        file.close unless file.closed?
        output_zip_file = [directory, :zip].join(".")
        Zip::File.open(output_zip_file, create: true) do |zipfile|
          Dir.glob(File.join(directory, '**', '**')).each do |file_path|
            next if file_path == output_zip_file

            path_in_zip = file_path.sub(/^#{Regexp.escape(directory)}\/?/, '')
            if File.directory?(file_path)
              zipfile.mkdir(path_in_zip) unless zipfile.find_entry(path_in_zip)
            else
              zipfile.add(path_in_zip, file_path)
            end
          end
        end
        FileUtils.rm_rf(directory)
      end

      def zip
        output_zip_file = [filename, :zip].join(".")
        Zip::File.open(output_zip_file, create: true) do |zipfile|
          Dir.glob(File.join(filename, '**', '*.zip')).each do |file_path|
            next if file_path == output_zip_file

            path_in_zip = file_path.sub(/^#{Regexp.escape(filename)}\/?/, '')
            if File.directory?(file_path)
              zipfile.mkdir(path_in_zip) unless zipfile.find_entry(path_in_zip)
            else
              zipfile.add(path_in_zip, file_path)
            end
          end
        end
        FileUtils.rm_rf(filename)
      end
    end

    def self.new(args = {})
      filename = [Hash(args).dig(:name) || ["export.CvatVideo.bundle", Time.now.to_i]].join(".")
      FileUtils.mkdir_p filename

      Context.new("CvatVideo", filename, nil, nil ,nil)
    end
  end
end
