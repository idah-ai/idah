require 'builder'

module Context
  module Cvat
    module Video
      Context = Data.define(:name, :filename, :i, :o, :e) do
      BuilderContext = Data.define(:builder, :close)
        def builder(args, &block)
          file = File.new([filename, args.to_a.join(".")].join("/"), 'w')
          xml_markup = Builder::XmlMarkup.new(:target=> file)
          xml_markup.instruct! :xml, :version=>"1.0", :encoding=>"UTF-8"
          yield xml_markup

          file.close unless file.closed?
        end


      end

      def self.prepare(args)
        filename = [Hash(args).dig(:name) || ["export", Time.now.to_i]].join(".")
        Dir.mkdir filename #

        Context.new("CvatVideo", filename, nil, nil ,nil)
      end
    end
  end
end