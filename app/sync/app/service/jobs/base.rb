# frozen_string_literal: true

module Jobs
  class Base
    @max_retries = 0

    class << self
      attr_accessor :max_retries
    end

    attr_reader :job_id,
                :arguments,
                :created_by,
                :created_by_role,
                :created_by_organization,
                :created_by_custom_scopes,
                :created_by_metadata

    def initialize(job)
      @job_id = job.id
      @arguments = job.arguments
      @created_by = job.created_by
      @created_by_role = job.created_by_role
      @created_by_organization = job.created_by_organization
      @created_by_custom_scopes = job.created_by_custom_scopes
      @created_by_metadata = job.created_by_metadata
    end

    def update_progress(value)
      emit(:update_progress, value:)
    end

    def reschedule(after: 10)
      emit(:reschedule, after:)
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
    rescue StandardError => e
      error(e)
    end

    def run_impl = raise NotImplementedError
  end
end
