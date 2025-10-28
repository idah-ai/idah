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

      case filename
      when "plugin.js"
      when "plugin.css"
      when "details.js"
      when "details.css"
      else
        return nil
      end



      find(plugin_name)

      # raise "TODO: Implement plugin frontend serving"
    end
  end
end