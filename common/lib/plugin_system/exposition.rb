module PluginSystem
  class Exposition < Verse::Exposition::Base
    expose on_resource_event(Resource::Setting::Plugins, :restart_required)
    def restart_plugin
      PluginSystem.restart_plugin(
        *message.values_at(
          :plugin_name,
          :plugin_version
        )
      )
    end
  end
end
