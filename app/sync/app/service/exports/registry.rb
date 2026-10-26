# frozen_string_literal: true

module Exports
  # Registry of export formats plugged in IDAH.
  module Registry
    extend self

    # For a given list of modalities, register the class as Export Class
    # @param modalities String|Regexp|Array(String|Regexp)
    # modalities matching this pattern are managed by the export class
    # @param klass Class
    # The export class
    def register(plugin_name, modalities, klass)
      modalities = [modalities] unless modalities in Array

      # The export dialog shows the exporter's options: reject what it cannot.
      Options.check!(options_schema(klass))

      @registry ||= {}

      modalities.each do |modality|
        unless modality in String | Regexp
          raise ArgumentError, "modality selector must be String or Regexp; #{modality.class} given"
        end

        # Register modality:
        @registry[modality] ||= Set.new

        # Add plugin name to klass
        klass.define_singleton_method(:plugin) do
          plugin_name.to_sym
        end

        @registry[modality] << klass
      end
    end

    def clear(plugin_name)
      plugin_name = plugin_name.to_sym
      @registry.each_value do |coll|
        coll.reject! { |klass| klass.plugin == plugin_name }
      end
    end

    def clear_all = @registry.clear

    # The registered export class of a given name, or nil.
    # @param name String the class name, as `/formats` lists it
    # @return Class|nil
    def export_class(name)
      @registry ||= {}
      @registry.each_value do |classes|
        found = classes.find { |klass| klass.to_s == name }
        return found if found
      end

      nil
    end

    # The options an export class declares, as a Verse::Schema.
    def options_schema(klass)
      klass.method_defined?(:options) ? klass.new.options : Verse::Schema.empty
    end

    def valid_export_class?(klass)
      @registry ||= {}
      @registry.each_value do |v|
        return true if v.map(&:to_s).include?(klass)
      end

      false
    end

    # Return the list of available export
    # format for given modalities
    # @return Array(Class) the export classes
    def list_export_format(modalities)
      @registry ||= {}

      formats = Set.new

      modalities.uniq.each do |modality|
        @registry.each do |key, value|
          case key
          when String
            formats += value if key == modality
          when Regexp
            formats += value if modality =~ key
          end
        end
      end

      formats.uniq
    end

    def list_export_format_details(modalities)
      list_export_format(modalities).map do |klass|
        exporter = klass.new

        {
          name: exporter.name,
          description: exporter.description,
          exporter: klass.to_s,
          options: Options.describe(options_schema(klass))
        }
      end
    end
  end
end
