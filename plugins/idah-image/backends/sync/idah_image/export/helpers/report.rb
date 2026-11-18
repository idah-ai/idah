# frozen_string_literal: true

require "json"
require "time"

module IdahImage
  module Export
    module Helpers
      # What an export wrote and what it left out, saved as export_report.json
      # next to the annotations so nothing is dropped without a trace. It
      # opens with the format and the options the export ran with, so the zip
      # says what it holds.
      class Report
        COUNTERS = %i[datasets images annotations image_files].freeze

        # @param format [String] the exporter's name, as in the export dialog
        # @param options [Hash] the options the export ran with
        def initialize(format: nil, options: {})
          @header = { format:, exported_at: Time.now.utc.iso8601, options: }
          @counts = COUNTERS.to_h { |name| [name, 0] }
          @skipped = Hash.new(0)
          @warnings = []
        end

        def count(name, amount = 1) = @counts[name] += amount

        def skip(reason) = @skipped[reason.to_s] += 1

        def warn(message) = @warnings << message

        def write(path)
          File.write(path, JSON.pretty_generate(@header.merge(@counts, skipped: @skipped, warnings: @warnings)))
        end
      end
    end
  end
end
