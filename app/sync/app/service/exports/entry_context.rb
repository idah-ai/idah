# frozen_string_literal: true

module Exports
  class EntryContext
    attr_reader :entry

    def initialize(entry)
      @entry = entry
    end

    def annotations
      Api[:idah].dataset.annotations.index_all(
        filter: {
          entry_id: @entry.id
        },
        included: ["project_members"]
      ).map do |annotation|
        AnnotationContext.new(annotation)
      end
    end

    def medias
      Api[:idah].media.medias.index_all(
        filter: {
          resource: @entry.resource
        }
      ).map do |media|
        MediaContext.new(media)
      end
    end
  end
end
