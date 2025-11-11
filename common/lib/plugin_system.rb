# frozen_string_literal: true

module PluginSystem
  extend self

  attr_reader :config, :registry

  @plugins = {}

  def init(context_class, registry_class = PluginSystem::Registry)
    Verse.on_boot do
      PluginSystem::Exposition.register
    end

    Verse.logger.info{ "[IDAH-PLUGIN] Initializing Plugin System" }
    @config = Config.new(
      Verse.config.extra_fields.dig(:idah, :plugins) || {}
    )

    @registry = registry_class.new(
      context_class
    )

    config.manual&.each do |plugin_name|
      @registry.register(
        plugin_name,
        File.join(
          @config.path, plugin_name
        ),
        manual: true
      )
    end

    # watch_sources if config.watch

    # Todo: Attach listeners
    # # Listen the plugin directory for changes
    # listener = nil

    # if config.watch
    #   path_index = plugins.select{ |_, v| v.manual }.map do |k, v|
    #     [v.path, plugins[k]]
    #   end.to_h

    #   root_paths = path_index.keys

    #   listener = Listen.to(*root_paths) do |modified, added, removed|
    #     file = (modified + added + removed)

    #     root_paths.select do |root_path|
    #       file.any?{ |f| f.start_with?(root_path) }
    #     end.unique.each do |path|
    #       path_index[path]&.reload
    #     end
    #   end
    # end

    # return unless config.watch

    # listener.start
  end
end
