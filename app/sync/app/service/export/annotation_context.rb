module Export
  class AnnotationContext
    attr_reader :annotation

    def initialize(annotation)
      @annotation = annotation
    end

    def self.from_annotation(annotation)
      AnnotationContext.new(annotation)
    end
  end
end