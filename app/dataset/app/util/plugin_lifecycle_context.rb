# frozen_string_literal: true

# Microservice specific
# context passed to the plugin code.
class PluginLifecycleContext
  def initialize(plugin_name)
    @plugin_name = plugin_name.to_sym
  end

  def register_workflow(name, class_name:)
    Workflow::Registry.register(
      @plugin_name,
      name,
      class_name:
    )
  end

  def mount_plugin(plugin_name)
    # Do nothing
  end

  def unmount_plugin
    Workflow::Registry.clear(@plugin_name)
  end
end
