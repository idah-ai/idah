# frozen_string_literal: true

require "forwardable"

module PluginSystem
  class Plugin
    extend Forwardable

    attr_reader :path, :manifest, :manual

    def initialize(path, manifest, manual: false)
      @path = path
      @manifest = manifest
      @manual = manual
    end

    # Helper to access the different fields of the manifest directly into
    # the plugin object via delegation.
    def_delegators :@manifest, *PluginSystem::Manifest.schema.fields.map(&:name)

    def self.from_manifest(manifest_file, manual: false)
      dir = File.dirname(manifest_file)
      manifest = Manifest.from_file(
        manifest_file
      )

      new(dir, manifest, manual:)
    end

    def start(context_class)
      service_name = Verse.service_name

      if manifest.entry_points&.backend&.path.nil?
        Verse.logger.info{ "[IDAH-PLUGIN] Plugin `#{manifest.name}` has no backend entry point, skipping load." }
        return;
      end

      path_to_code = File.join(
        @path,
        manifest.entry_points.backend.path,
        service_name
      )

      if !File.directory?(path_to_code)
        Verse.logger.info{
          "[IDAH-PLUGIN] Plugin `#{manifest.name}` backend path `#{path_to_code}` does not exist, skipping load."
        }
        return;
      end

      @loader = Zeitwerk::Loader.new
      @loader.push_dir(path_to_code)
      @loader.setup

      Verse.logger.info{ "[IDAH-PLUGIN] Starting plugin #{manifest.name} (v#{manifest.version})..." }

      @context = context_class.new(
        manifest.name
      )

      # Load the main module:
      Object.const_get(
        manifest.entry_points.backend.module
      ).init(@context)

      self
    end

    def stop
      @context&.unmount_plugin
      self
    ensure
      @loader&.unload
      @loader = nil
    end

    def reload
      Verse.logger.info{ "Reload plugin #{manifest.name}" }
      stop
      start
      Verse.logger.info{ "Reload plugin #{manifest.name} done" }
    end
  end
end
