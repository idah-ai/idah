module PluginSystem
  extend self

  @plugins = {}

  def init(context_class)
    plugin_config = Config.new(
      Verse.config.extra_fields.fetch(:idah_plugins, {})
    )

    plugin_config.manual&.each do |plugin_name|
      load_plugin "#{plugin_config.path}/#{plugin_name}"
    end

    binding.pry
  end

  def manual_load_plugin(path, plugin_name)
    plugin_path = File.absolute_path(
      File.join(path, plugin_name)
    )

    Verse.logger.info{ "Load plugin #{plugin_path}" }

    # 1. Load the manifest:
    manifest_path = File.join(plugin_path, "manifest.json")

    if !File.exist?(manifest_path)
      Verse.logger.warn{ "Plugin manifest not found at #{manifest_path}" }
    end

    Plugin.new(
      Manifest.new(
        JSON.parse(File.read(manifest_path))
      )
    )
  end

  def attach_plugin()

  end
end
