# frozen_string_literal: true

module {{pluginModule}}
  class Export
    attr_reader :context

    def initialize(context)
      @context = context
    end

    def run
      raise NotImplementedError, "plugin must implement the run method for exporting data"
    end
  end
end
