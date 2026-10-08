# frozen_string_literal: true

require "tempfile"
require "timeout"

module Exports
  class MediaContext
    attr_reader :record

    # Timeout for media download (in seconds)
    DOWNLOAD_TIMEOUT = 300

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
