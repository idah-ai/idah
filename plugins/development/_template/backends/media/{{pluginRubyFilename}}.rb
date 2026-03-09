# frozen_string_literal: true

module {{pluginModule}}
  def self.init(context)
    context.register_processor(
      "{{pluginName}}",
      class_name: "{{pluginModule}}::Processor",
      options_class_name: "{{pluginModule}}::Options"
    )
  end
end
