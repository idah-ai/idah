# frozen_string_literal: true

module PluginSystem
  # Reads which shape types are "system shapes" from the plugin manifests —
  # shapes the plugin produces itself (e.g. a coverage mask's "done area")
  # rather than shapes annotators draw. A shape type is
  # `"<modality id>:<shape name>"`. Dataset leaves them out of entry stats, and
  # the UPD export leaves them out of the file.
  #
  # `for_all` reads the loaded plugins live on every call — a few plugins with a
  # few shapes is cheap, and reading live keeps the result right if a plugin is
  # unloaded or reloaded. With no plugin system initialized, it returns an empty
  # Set.
  module SystemShapes
    module_function

    def for_all
      registry = PluginSystem.registry
      return Set.new unless registry

      modalities = registry.plugins.values.compact.flat_map do |plugin|
        plugin.modalities || []
      end

      from_modalities(modalities)
    end

    # Pure: same lookup over given modalities. The parsed manifest gives struct
    # modalities whose fields are Symbols (including :system_shapes and shape
    # names like :"done-area"); raw hashes may use String keys. The returned Set
    # contains "modality_id:shape_name" Strings.
    def from_modalities(modalities)
      return Set.new unless modalities

      modalities.each_with_object(Set.new) do |raw_mod, out|
        mod = raw_mod.respond_to?(:to_h) ? raw_mod.to_h : raw_mod
        next unless mod.is_a?(Hash)

        modality_id = mod[:id].to_s
        next if modality_id.empty?

        system_shapes = mod[:system_shapes]
        next unless system_shapes.is_a?(Hash)

        system_shapes.each_key do |shape_name|
          out << "#{modality_id}:#{shape_name}"
        end
      end
    end
  end
end
