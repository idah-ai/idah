# frozen_string_literal: true

require "json"

module IdahImage
  module Export
    module Helpers
      # What an export wrote and what it left out, saved as export_report.json
      # next to the annotations so nothing is dropped without a trace.
      class Report
        COUNTERS = %i[datasets images annotations image_files].freeze

        def initialize
          @counts = COUNTERS.to_h { |name| [name, 0] }
          @skipped = Hash.new(0)
          @warnings = []
        end

        def count(name, amount = 1) = @counts[name] += amount

        def skip(reason) = @skipped[reason.to_s] += 1

        def warn(message) = @warnings << message

        def write(path)
          File.write(path, JSON.pretty_generate(@counts.merge(skipped: @skipped, warnings: @warnings)))
        end
      end
    end
  end
end
