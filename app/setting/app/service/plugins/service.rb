# frozen_string_literal: true

module Plugins
  class Service < Verse::Service::Base
    use repo: Plugin::Repository

    def install(_plugin_name)
      Manager.run do
        install_plugin
      end
    end

    def find(plugin_name)
      # 1. check for manual plugins
      manual_plugins = Verse.config.extra_fields.dig(
        :idah, :plugins, :manual
      ) || []
      plugin_path = Verse.config.extra_fields.dig(
        :idah, :plugins, :path
      ) || "plugins"

      manual_plugins.find{ |p| p == plugin_name }&.then do
        return Plugin::Record.from_path(
          File.join(plugin_path, plugin_name)
        )
      end

      # 2. if manual plugin not found, check in the database
      repo.find_by({ name: plugin_name })
    end

    def serve_asset(plugin_name, filename)
      plugin = find(plugin_name)

      manifest = plugin&.manifest
      return nil unless manifest

      assets_directory = manifest.entry_points&.assets_directory
      return nil unless assets_directory

      asset_path = File.join(
        plugin.path,
        assets_directory,
        filename
      )

      return nil unless File.exist?(asset_path)

      File.open(asset_path, "rb")
    end

    # Return a hash in the form of:
    #
    # {
    #   modalities: { id: {label: "...", description: "..."} },
    #   plugins: { "modA": ["plugin1", "plugin2"], ... }
    # }
    def show_modalities
      output = {
        modalities: {},
        plugins: {}
      }

      PluginSystem.registry.plugins.each do |name, plugin|
        modalities = plugin.modalities
        next unless modalities

        modalities.each do |mod|
          mod_id = mod.id
          mod_hash = (output[:modalities][mod_id] ||= {})
          mod_hash[:label] ||= mod.label
          mod_hash[:description] ||= mod.description

          plugin_arr = (output[:plugins][mod_id] ||= [])
          plugin_arr << name
        end
      end

      output
    end

    def serve_file(plugin_name, filename)
      plugin = find(plugin_name)

      manifest = plugin&.manifest
      return nil if manifest.nil?

      file_path = \
        case filename
        when "plugin.js", "plugin.css"
          entry_plugin = manifest.entry_points&.entry_plugin
          return nil unless entry_plugin

          is_style = filename.end_with?(".css")

          if is_style
            entry_plugin.style
          else
            entry_plugin.script
          end
        when "details.js", "details.css"
          entry_details = manifest.entry_points&.entry_details
          return nil unless entry_details

          is_style = filename.end_with?(".css")

          if is_style
            entry_details.style
          else
            entry_details.script
          end
        when "dataset_config.json"
          return manifest.entry_points.dataset_config if
            manifest.entry_points&.dataset_config
        when "plugin_shortcut.json"
          return manifest.entry_points.plugin_shortcut if
            manifest.entry_points&.plugin_shortcut
        end

      return nil if file_path.nil?

      return unless file_path

      File.read(
        File.join(plugin.path, file_path)
      )
    end
  end
end
