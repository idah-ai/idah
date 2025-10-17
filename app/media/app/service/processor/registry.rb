# frozen_string_literal: true

module Processor
  module Registry
    extend self

    @processors = {}

    def register(plugin_name, name, processor_class)
      @processors[name.to_sym] = [plugin_name.to_sym, processor_class]
    end

    def clear(plugin_name)
      plugin_name = plugin_name.to_sym
      @processors.reject!{ |_, (mod, _)| mod == plugin_name }
    end

    def clear_all = @processors.clear

    def get(name)
      @processors[name.to_sym]&.last
    end
  end
end
