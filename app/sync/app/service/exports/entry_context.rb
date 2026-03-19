# frozen_string_literal: true

module Exports
  class EntryContext
    attr_reader :record

    def initialize(entry)
      @record = entry
    end

    def annotations(filter = {})
      Api[:idah].dataset.annotations.index_all(
        filter: filter.merge(entry_id: @record.id),
        included: ["project_members"]
      ).map do |annotation|
        AnnotationContext.new(annotation)
      end
    end

    def medias(filter = {})
      Api[:idah].media.medias.index_all(
        filter: filter.merge(resource: @record.resource)
      ).map do |media|
        MediaContext.new(media)
      end
    end
  end
end
