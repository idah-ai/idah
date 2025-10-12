module PluginSystem
  class Plugin
    def initialize(path, manifest)
      @path = path
      @manifest = manifest
    end

    def start
      binding.pry

      backend_info = \
        manifest.entry_points.backends[Verse.service_name]
    end

    def stop
    end

    def reload
    end

    # Use the repository
    # to update the plugin
    def update
    end
  end
end
