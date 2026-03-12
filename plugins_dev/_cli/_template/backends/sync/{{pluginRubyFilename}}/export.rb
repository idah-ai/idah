# frozen_string_literal: true

module {{pluginModule}}
  class Export
    def name = "{{pluginDisplayName}} Export"
    def description = "Export data in {{pluginDisplayName}} format."
    def options = Verse::Schema.empty

    def export(context)
      raise NotImplementedError, "plugin must implement the run method for exporting data"
    end
  end
end
