# frozen_string_literal: true

module AnnotationDiff
  # Reads which arrays inside `shape_args` are keyed, and by what, from the
  # plugin manifests (each shape and tagging entry may declare an `args` Hash;
  # only `type: "array"` entries with a non-empty String `x-identity-key` are
  # read). A shape type is `"<modality id>:<shape name>"`.
  #
  # `for` reads the loaded plugins live on every call — a few plugins with a
  # few shapes is cheap, and reading live keeps the result right if a plugin is
  # unloaded or reloaded. With no plugin system initialized, it returns {}.
  module IdentityKeys
    module_function

    def for(shape_type)
      registry = PluginSystem.registry
      return {} unless registry

      modalities = registry.plugins.values.compact.flat_map do |plugin|
        plugin.modalities || []
      end

      from_modalities(modalities, shape_type)
    end

    # Pure: same lookup over given modalities. The parsed manifest gives struct
    # modalities whose fields are Symbols (including :"bounding-box"); within
    # `args` the nested entries keep the manifest's String keys
    # ({"type" => ..., "x-identity-key" => ...}). The returned hash uses String
    # keys and values.
    def from_modalities(modalities, shape_type)
      return {} unless shape_type.is_a?(String)
      return {} unless shape_type.include?(":")

      modality_id, shape_name = shape_type.split(":", 2)

      modalities.each do |raw_mod|
        mod = raw_mod.respond_to?(:to_h) ? raw_mod.to_h : raw_mod
        next unless mod.is_a?(Hash)
        next unless mod[:id].to_s == modality_id

        shape = fetch_shape(mod[:shapes], shape_name)
        shape ||= fetch_shape(mod[:tagging], shape_name)
        next unless shape

        shape = shape.to_h if shape.respond_to?(:to_h)
        next unless shape.is_a?(Hash)
        next unless shape[:args].is_a?(Hash)

        keys = identity_keys_for(modality_id, shape_name, shape[:args])
        return keys unless keys.empty?
      end

      {}
    end

    def fetch_shape(container, shape_name)
      return nil unless container.is_a?(Hash)

      container.fetch(shape_name.to_sym, nil) || container.fetch(shape_name.to_s, nil)
    rescue KeyError
      nil
    end

    def identity_keys_for(modality_id, shape_name, args)
      args.each_with_object({}) do |(key, entry), out|
        # The parsed manifest's `args` is an open Hash: its own top-level keys
        # are symbols, but the nested entries keep the manifest's String keys
        # ({"type" => ..., "x-identity-key" => ...}).
        entry = entry.to_h if entry.respond_to?(:to_h)
        entry = entry.transform_keys(&:to_s) if entry.is_a?(Hash)
        identity_key = entry["x-identity-key"] if entry.is_a?(Hash)

        unless entry.is_a?(Hash) && entry["type"] == "array" && valid_identity_key?(identity_key)
          Verse.logger.warn do
            "[annotation-diff] ignoring identity key for #{modality_id}:#{shape_name} `#{key}`: " \
              "expected an entry with type \"array\" and a non-empty String x-identity-key"
          end
          next
        end

        out[key.to_s] = identity_key.to_s
      end
    end

    def valid_identity_key?(value)
      value.is_a?(String) && !value.empty?
    end
  end
end
