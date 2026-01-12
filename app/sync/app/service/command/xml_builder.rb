require 'builder'

module Command
  class XmlBuilder < Base
    attr_reader :builder
    def initialize(**opts)
      filename = opts.dig(:filename)
      file = File.new(filename, 'w')
      @builder = Builder::XmlMarkup.new(
        :target => file,
        :indent => 2
      )
      @builder.instruct! :xml, :version=>"1.0", :encoding=>"UTF-8"
      super(file, **opts)
    end

  end
end