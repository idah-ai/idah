# frozen_string_literal: true

module PluginSystem
  class Plugin
    attr_reader :path, :manifest, :manual

    def initialize(path, manifest, context_class, manual: false)
      @path = path
      @manifest = manifest
      @manual = manual
      @context_class = context_class
    end

    def start
      @loader = Zeitwerk::Loader.new
      @loader.push_dir(@path)
      @loader.setup

      Verse.logger.info{ "Starting plugin #{manifest.name} (v#{manifest.version})" }

      mod = Object.const_get(
        manifest.entry_points.backend.module
      )
      @context = @context_class.new(manifest.name)
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

  end
end
