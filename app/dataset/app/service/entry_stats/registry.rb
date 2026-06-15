# frozen_string_literal: true

module EntryStats
  module Registry
    extend self

    # @registry: Hash{ String => Class } keyed by modality (e.g. "idah-video").
    # Each modality maps to exactly one generator class (1:1).

    def register(plugin_name, modality, klass)
      @registry ||= {}

      if @registry.key?(modality)
        raise ArgumentError,
              "EntryStats generator for modality '#{modality}' already registered " \
              "by plugin '#{@registry[modality].plugin}'"
      end

      klass.define_singleton_method(:plugin) { plugin_name.to_sym }
      @registry[modality] = klass
    end

    def clear(plugin_name)
      return unless @registry

      plugin_sym = plugin_name.to_sym
      @registry.delete_if { |_modality, klass| klass.plugin == plugin_sym }
    end

    def clear_all
      @registry = {}
    end

    # @return [Class, nil]
    def get(modality)
      return nil unless @registry

      @registry[modality]
    end
  end
end
