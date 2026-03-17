# frozen_string_literal: true

module Exports
  class AnnotationContext
    attr_reader :record

    def initialize(annotation)
      @record = annotation
    end
  end
end
