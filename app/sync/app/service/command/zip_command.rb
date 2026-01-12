require 'zip'
module Command
  class ZipCommand < Base
    def zip(*path, zipname: nil)
      output = zipname ? File.join(filename, zipname) : filename
      puts({path:, zipname:, filename:, output:})
      Zip::File.open([output, :zip].join("."), create: true) do |zip|
        puts({zip:})
        Dir.glob(File.join(output, *path)).each do |file_path|
        puts({file_path:})
          path_in_zip = file_path.sub(/^#{Regexp.escape(output)}\/?/, '')

          return path_in_zip if path_in_zip.empty?

          if File.directory?(file_path)
            zip.mkdir(path_in_zip) unless zip.find_entry(path_in_zip)
          else
            zip.add(path_in_zip, file_path)
          end
        end
      end
    end
  end
end