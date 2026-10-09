# frozen_string_literal: true

require "yaml"

module IdahVideo
  module Export
    # What an export wrote and what it left out, saved as export_report.yml
    # next to the annotations so nothing is dropped without a trace.
    #
    # Not JSON: CVAT parses every JSON file of an imported zip as COCO and
    # fails on this one.
    class Report
      COUNTERS = %i[videos images annotations interpolated_annotations track_end_frames image_files].freeze

      def initialize
        @counts = COUNTERS.to_h { |name| [name, 0] }
        @skipped = Hash.new(0)
        @warnings = []
      end

      def count(name, amount = 1) = @counts[name] += amount

      def skip(reason) = @skipped[reason.to_s] += 1

      def warn(message) = @warnings << message

      def write(path)
        report = @counts.merge(skipped: @skipped, warnings: @warnings)
        File.write(path, YAML.dump(Keys.stringify(report)))
      end
    end
  end
end
