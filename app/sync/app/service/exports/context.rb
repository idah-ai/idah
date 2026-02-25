# frozen_string_literal: true

module Exports
  class Context
    attr_reader :dataset_ids, :options

    def initialize(job, dataset_ids, options = {})
      @job = job
      @dataset_ids = dataset_ids
      @options = options
    end

    def io
      @io_context ||= IoContext.new
    end

    def progress=(value)
      @job.progress = value
    end

    def reschedule!(after: 10)
      @job.reschedule!(after:)
    end

    def error!(message)
      @job.error(message)
    end

    def datasets
      Enumerator.new do |yielder|
        size = @dataset_ids.size

        @dataset_ids.each_with_index do |id, idx|
          yielder << DatasetContext.new(id)

          @job.update_progress((idx + 1.0) / size)
        end
      end
    end
  end
end
