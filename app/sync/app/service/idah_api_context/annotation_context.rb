module IdahApiContext
  class AnnotationContext
    attr_reader :annotation

    def initialize(annotation)
      @annotation = annotation
    end

    def self.from_annotation(annotation)
      # could be extended with comments or else
      new(annotation)
    end
  end
end