module PluginSystem
  extend self

  attr_reader :config, :plugins

  @plugins = {}

  def init(context_class)
    @config = Config.new(
      Verse.config.extra_fields.dig(:idah, :plugins) || {}
    )

    config.manual&.each do |plugin_name|
      manual_load_plugin config.path, plugin_name
    end

    # Listen the plugin directory for changes
    listener = nil

    if config.watch
      path_index = plugins.select{ |_, v| v.manual }.map do |k, v|
        [v.path, plugins[k]]
      end.to_h

      root_paths = path_index.keys

      listener = Listen.to(*root_paths) do |modified, added, removed|
        file = (modified + added + removed)

        path_to_reload = root_paths.select do |root_path|
          file.any?{ |f| f.start_with?(root_path) }
        end.unique.each do |path|
          path_index[path].each(&:reload)
        end
      end
    end

    # Load the plugins:
    plugins.each_value(&:start)

    if config.watch
      listener.start
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
      return
    end

    begin
      manifest = Manifest.new(
        JSON.parse(
          File.read(manifest_path)
        )
      )

      backend = manifest.entry_points.backend

      # No backend code for this plugin, skip loading
      return unless backend

      service_backend_path = File.join(plugin_path, backend.path, Verse.service_name)

      unless Dir.exist?(service_backend_path)
        Verse.logger.debug{
          "No backend for service #{Verse.service_name} in plugin #{plugin_name}"
        }
        return
      end

      @plugins[manifest.name.to_sym] = Plugin.new(service_backend_path, manifest, manual: true)
    rescue Verse::Schema::InvalidSchemaError => e
      Verse.logger.error{ "Plugin manifest validation error: #{e.message}" }
      return
    end

  end
end
