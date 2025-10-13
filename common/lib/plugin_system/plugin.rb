module PluginSystem
  class Plugin
    attr_reader :path, :manifest, :manual

    def initialize(path, manifest, manual: false)
      @path = path
      @manifest = manifest
      @manual = manual
    end

    def start
      @loader = Zeitwerk::Loader.new
      @loader.push_dir(@path)
      @loader.setup

      Verse.logger.info{ "Starting plugin #{manifest.name} (v#{manifest.version})" }

      mod = Object.const_get(
        manifest.entry_points.backend.module
      )
      @context = PluginLifecycleContext.new(
        manifest.name
      )
      mod.init(@context)

      self
    end

    def stop
      @context&.unmount_plugin
      @loader&.unload
      @loader = nil

      self
    end

    def reload
      Verse.logger.info{ "Reload plugin #{manifest.name}" }
      stop
      start
      Verse.logger.info{ "Reload plugin #{manifest.name} done" }
    end

    # Use the repository
    # to update the plugin
    def update
      # TODO...
    end
  end
end
