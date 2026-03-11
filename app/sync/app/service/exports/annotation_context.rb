# frozen_string_literal: true

module Exports
  class AnnotationContext
    attr_reader :annotation

    def initialize(annotation)
      @annotation = annotation
    end
  end
end
