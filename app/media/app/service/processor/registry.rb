# frozen_string_literal: true

module Processor
  module Registry
    extend self

    @processors = {}

    Entry = Data.define(:plugin, :class_name, :options_class_name)

    def register(plugin_name, modality,
                 class_name:,
                 options_class_name: "Schema::Empty")
      modality = modality.to_sym
      @processors[modality] ||= []
      @processors[modality] <<
        Entry.new(
          plugin: plugin_name.to_sym,
          class_name:,
          options_class_name:
        )
    end

    def clear(plugin_name)
      plugin_name = plugin_name.to_sym
      @processors.each_value do |coll|
        coll.reject! { |entry| entry.plugin == plugin_name }
      end
    end

    def clear_all = @processors.clear

    def get(name)
      name = name.to_sym
      entries = @processors[name]
      return nil if entries.nil?

      entries
    end
  end
end
