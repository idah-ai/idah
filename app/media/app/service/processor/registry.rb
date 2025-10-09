module Processor
  module Registry
    @processors = {}

    def self.register(name, processor_class)
      @processors[name] = processor_class
    end

    def self.get(name)
      @processors[name]
    end
  end
end
