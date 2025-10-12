module PluginSystem
  module_function

  def init(context_class)
    plugin_config = Config.new(
      Verse.config.extra_fields.fetch(:plugins, {})
    )

    binding.pry

  end
end
