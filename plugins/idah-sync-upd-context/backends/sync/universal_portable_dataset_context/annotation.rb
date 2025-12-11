module UniversalPortableDatasetContext
  class Annotation
    attr_reader :annotation

    def initialize(annotation)
      @annotation = annotation
    end

    def self.from_annotation(annotation)
      Annotation.new(annotation)
    end
  end
end