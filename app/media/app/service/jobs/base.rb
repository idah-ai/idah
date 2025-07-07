# frozen_string_literal: true

module Jobs
  class Base
    @max_retries = 0

    class << self
      attr_accessor :max_retries
    end

    attr_reader :job_id, :arguments

    def initialize(job_id, arguments)
      @job_id = job_id
      @arguments = arguments
    end

    def update_progress(value)
      emit(:update_progress, value:)
    end

    def reschedule(in: 10)
      emit(:reschedule, in:)
    end

    def error(message)
      emit(:error, error: message)
    end

    def emit(event, **args)
      @command.call(
        event, **args
      )
    end

    def run(&block)
      @command = block
      run_impl
    end

    def run_impl = raise NotImplementedError
  end
end
