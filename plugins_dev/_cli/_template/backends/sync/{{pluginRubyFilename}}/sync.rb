# frozen_string_literal: true

module {{pluginModule}}
  class Sync
    def self.init(context)
      context.register_exports(
        "{{pluginName}}",
        {{pluginModule}}::Export
      )
    end
  end
end
