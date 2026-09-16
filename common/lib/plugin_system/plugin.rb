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
      warn_if_platform_too_old

      service_name = Verse.service_name
      service_class_name = service_name.split(/[-_]+/).map(&:capitalize).join

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
      # e.g., IdahVideo::Media for media service or IdahVideo::Sync for sync service.
      # This is to allow different backend modules for different services
      Object.const_get(
        [manifest.entry_points.backend.module, service_class_name].join("::")
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

    # `idahVersion` in the manifest is the oldest platform version the plugin
    # works with. This warns rather than refuses to load: on 0.x any minor may
    # break a plugin, and an operator is better served by a running platform
    # with a loud log line than by a service that will not start.
    def warn_if_platform_too_old
      required = manifest.idah_version
      return if required.nil?

      # A build that was not stamped by the release workflow has no version to
      # compare against.
      current = IdahVersion.number
      return if current == IdahVersion::DEV_VERSION

      return if SemanticVersion[current] >= SemanticVersion[required]

      Verse.logger.warn{
        "[IDAH-PLUGIN] Plugin `#{manifest.name}` needs IDAH #{required} or later, " \
        "this is #{current}. Loading it anyway."
      }
    rescue StandardError => e
      # A malformed idahVersion, or any bug in this check, must never stop a
      # plugin - let alone the service - from starting.
      Verse.logger.warn{
        "[IDAH-PLUGIN] Plugin `#{manifest.name}` compatibility check failed: #{e.message}"
      }
    end

    def reload
      Verse.logger.info{ "Reload plugin #{manifest.name}" }
      stop
      start
      Verse.logger.info{ "Reload plugin #{manifest.name} done" }
    end
  end
end
