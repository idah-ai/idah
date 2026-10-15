# frozen_string_literal: true

require "json"

module IdahVideo
  module Export
    module Helpers
      # What an export wrote and what it left out, saved as export_report.json
      # next to the annotations so nothing is dropped without a trace.
      class Report
        COUNTERS = %i[datasets videos images annotations interpolated_annotations image_files].freeze

        def initialize
          @counts = COUNTERS.to_h { |name| [name, 0] }
          @skipped = Hash.new(0)
          @split_groups = []
          @warnings = []
        end

        def count(name, amount = 1) = @counts[name] += amount

        def skip(reason) = @skipped[reason.to_s] += 1

        def warn(message) = @warnings << message

        # A group whose rows have different categories, exported as one track
        # per category.
        def split_group(details) = @split_groups << details

        def write(path)
          report = @counts.merge(skipped: @skipped, split_groups: @split_groups, warnings: @warnings)
          File.write(path, JSON.pretty_generate(report))
        end
      end
    end
  end
end
