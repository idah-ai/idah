# frozen_string_literal: true

module Exports
  class MediaContext
    attr_reader :record

    def initialize(media)
      @record = media
    end

    def download
      Api[:idah].media.medias.files(
        resource: @record.resource,
        key: @record.key,
      )
    end
  end
end
