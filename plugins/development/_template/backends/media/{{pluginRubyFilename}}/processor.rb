# frozen_string_literal: true

module {{pluginModule}}
  class Processor
    attr_reader :context

    def initialize(context)
      @context = context
    end

    def run
      raise NotImplementedError, "plugin must implement the run method for processing media"
    end
  end
end
