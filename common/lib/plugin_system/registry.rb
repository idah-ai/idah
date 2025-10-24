module PluginSystem
  # In charge of loading
  # locally the different plugins.
  # Can be reimplemented for the settings
  # service since the settings service
  # is in charge of managing plugins.
  class Registry
    attr_reader :context_class, :path, :plugins

    def initialize(context_class)
      @context_class = context_class
      @plugins = {}
    end

    def register(name, path, manual: false)
      unless Dir.exist?(path)
        if manual
          Verse.logger.warn{ "[IDAH-PLUGIN] Plugin path `#{path}` does not exist." }
          return
        end

        retrieve_plugin(name, version)
      end

      plugin = Plugin.from_manifest(File.join(plugin_path, "manifest.json"))

      # Unload current plugin if loaded
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
