# frozen_string_literal: true

# Dataset-service specific context passed to plugin code on init/deinit.
class PluginLifecycleContext
  def initialize(plugin_name)
    @plugin_name = plugin_name.to_sym
  end

  def register_stats_generator(modality, klass)
    EntryStats::Registry.register(@plugin_name, modality, klass)
  end

  def mount_plugin(_plugin_name)
    # No-op
  end

  def unmount_plugin
    EntryStats::Registry.clear(@plugin_name)
  end
end
