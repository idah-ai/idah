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

    # Stream the media binary directly to a tempfile without loading
    # the entire file into memory. Returns the tempfile path.
    # The tempfile is opened in binmode and rewound before returning.
    def stream_download_to_tempfile(base_name, extension)
      tempfile = Tempfile.new([base_name, extension])
      tempfile.binmode

      Api[:idah].media.medias.files_stream(
        resource: @record.resource,
        key: @record.key,
      ) do |chunk|
        tempfile << chunk
      end

      tempfile.rewind
      tempfile.path
    end
  end
end
