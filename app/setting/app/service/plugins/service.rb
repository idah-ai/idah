module Plugins
  class Service < Verse::Service::Base
    use repo: Plugin::Repository

    def install(plugin_name)
      Manager.run do
        install_plugin()
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

      manual_plugins.find{|p| p == plugin_name }&.then do
        return Plugin::Record.from_path(
          File.join(plugin_path, plugin_name)
        )
      end

      # 2. if manual plugin not found, check in the database
      return repo.find_by({name: plugin_name})
    end

    def serve_asset(plugin_name, filename)
      plugin = find(plugin_name)

      return nil unless plugin

      binding.pry
    end

    def serve_file(plugin_name, filename)
      plugin = find(plugin_name)

      manifest = plugin.manifest
      return nil if manifest.nil?

      file_path = \
        case filename
        when "plugin.js", "plugin.css"
          entry_plugin = manifest.entry_points&.entry_plugin
          return nil unless entry_plugin

          is_style = filename.end_with?(".css")

          is_style ?
            entry_plugin.style :
            entry_plugin.script
        when "details.js", "details.css"
          entry_details = manifest.entry_points&.entry_details
          return nil unless entry_details

          is_style = filename.end_with?(".css")

          is_style ?
            entry_details.style :
            entry_details.script
        when "dataset_config.json"
          return manifest.entry_points.dataset_config if
            manifest.entry_points&.dataset_config
        when "plugin_shortcut.json"
          return manifest.entry_points.plugin_shortcut if
            manifest.entry_points&.plugin_shortcut
        else nil
        end

      return nil if file_path.nil?

      if file_path
        File.read(
          File.join(plugin.path, file_path)
        )
      end
    end
  end
end