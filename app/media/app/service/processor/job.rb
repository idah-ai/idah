# frozen_string_literal: true

module Processor
  class Job < Jobs::Base
    attr_reader :entry_id, :processor_class, :options_class

    def run_impl
      @entry_id = arguments.fetch(:entry_id)

      resource = arguments.fetch(:resource)

      # Skip re-processing when this resource has already been fully processed
      # (e.g. the entry was duplicated and shares the original's media). Returning
      # here completes the job normally, so the entry still advances off "start"
      # via the usual job-completed flow — only the expensive download + transcode
      # is skipped. Gated on a *completed* sibling job so retries of a partially
      # processed resource still run.
      jobs = Jobs::Repository.new(Verse::Auth::Context.new)
      if jobs.processed_resource?(resource, except_job_id: job_id)
        Verse.logger&.info {
          "[Processor] Resource #{resource} already processed; " \
            "skipping reprocessing for entry #{@entry_id}"
        }
        return
      end

      processor_class_name = arguments.fetch(:processor_class_name)
      options_class_name   = arguments.fetch(:options_class_name)
      options = arguments.fetch(:options, {})

      processor_class = Verse::Util::Reflection.constantize(
        processor_class_name
      )

      options_class = Verse::Util::Reflection.constantize(
        options_class_name
      )

      # Generate the context
      context = Processor::Context.new(
        Verse::Auth::Context.new,
        self,
        resource,
        options_class.new(**options)
      )

      processor_instance = processor_class.new(context)
      processor_instance.run
    end
  end
end
