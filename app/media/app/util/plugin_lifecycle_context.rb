# Microservice specific
# context passed to the plugin code.
class PluginLifecycleContext
  def initialize(plugin_name)
    @plugin_name = plugin_name.to_sym
  end

  def register_processor(name, processor_class)
    Processor::Registry.register(
      @plugin_name, name, processor_class
    )
  end

  def mount_plugin(plugin_name)
    # Do nothing
  end

  def unmount_plugin
    Processor::Registry.clear(@plugin_name)
  end
end