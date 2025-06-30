# frozen_string_literal: true

module Jobs
  class Base
    attr_reader :arguments

    def initialize(arguments)
      @arguments = arguments
    end

    def run = raise NotImplementedError
  end
end
