# frozen_string_literal: true

module Exports
  class MediaContext
    attr_reader :media

    def initialize(media)
      @media = media
    end

    def download
      Api[:idah].media.medias.files(
        resource: @media.resource,
        key: @media.key,
      )
    end
  end
end
