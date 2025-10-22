module PluginSystem
  # In charge of loading
  # locally the different plugins.
  # Can be reimplemented for the settings
  # service since the settings service
  # is in charge of managing plugins.
  class Registry
    attr_reader :context_class, :path, :plugins

    def initialize(context_class, path)
      @context_class = context_class
      @path = path
      @plugins = {}
    end

    def load_plugin(name, version, manual: false)
      if !manual && version.nil?
        raise ArgumentError,
          "Version must be specified for managed plugins"
      end

      plugin_path = manual ?
        File.join(@path, "#{name}-#{version}") :
        File.join(@path, name)

      if !Dir.exist?(plugin_path)
        if manual
          Verse.logger.warn{ "[IDAH-PLUGIN] Plugin path `#{plugin_path}` does not exist." }
          return
        end

        retrieve_plugin(name, version)
      end

      plugin = Plugin.from_manifest(File.join(
        plugin_path, "manifest.json"
        )
      )

      # Unload current plugin if any
      unload_plugin(name)

      @plugins[name] = plugin

      plugin.start(context_class)

      plugin
    end

    def plugin_exists?(name) = @plugins.key?(name)

    def unload_plugin(name)
      @plugins[name]&.tap do |plugin|
        plugin.stop
      ensure
        @plugins[name] = nil
      end
    end

    def retrieve_plugin(name, version)
      raise "TODO: Implement plugin retrieval from remote repository"
    end
  end
end
