# frozen_string_literal: true

module Processor
  module Registry
    extend self

    @processors = {}

    def register(plugin_name, name, processor_class)
      @processors[name] = [plugin_name, processor_class]
    end

    def clear(plugin_name)
      @processors.reject!{ |_, (mod, _)| mod == plugin_name }
    end

    def get(name)
      @processors[name]&.last
    end
  end
end
