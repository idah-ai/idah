# frozen_string_literal: true

module Exports
  class EntryContext
    attr_reader :record

    def initialize(entry)
      @record = entry
    end

    def annotations(filter = {})
      Enumerator.new do |yielder|
        Api[:idah].dataset.annotations.index_all(
          filter: filter.merge(entry_id: @record.id),
          included: ["project_members"]
        ).each do |page|
          page.each { |annotation| yielder << AnnotationContext.new(annotation) }
        end
      end
    end

    def medias(filter = {})
      Enumerator.new do |yielder|
        Api[:idah].media.medias.index_all(
          filter: filter.merge(resource: @record.resource)
        ).each do |page|
          page.each { |media| yielder << MediaContext.new(media) }
        end
      end
    end
  end
end
