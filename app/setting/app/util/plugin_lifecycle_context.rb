# frozen_string_literal: true

class PluginLifecycleContext
  def initialize(plugin_name)
    @plugin_name = plugin_name.to_sym
  end

  def mount_plugin(plugin_name)
    # Do nothing
  end

  def unmount_plugin
    # Do nothing
  end
end
