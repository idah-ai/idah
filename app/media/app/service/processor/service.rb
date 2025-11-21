# frozen_string_literal: true

module Processor
  class Service < Verse::Service::Base
    use_system jobs: Jobs::Repository

    def process_entry(entry_id)
      entry = Api[:idah].dataset.entries.show(
        id: entry_id,
        included: %w[dataset]
      )

      # Check the modality of the dataset:
      modality = entry.dataset.modality

      # Check if there is already a job:
      if entry.job_id
        job = jobs.find(entry.job_id)

        # Do not re-run if already running or pending
        return if job && %w[pending running].include?(job.status)
      end

      processor_entries = Registry.get(modality)

      if processor_entries.nil? || processor_entries.empty?
        Api[:idah].dataset.entries.update(
          id: entry.id,
          status: "ready"
        )
        return
      end

      processor_entries.each do |processor_entry|
        job_id = jobs.create(
          job_class: "Processor::Job",
          arguments: {
            entry_id:,
            processor_class_name: processor_entry.class_name,
            options_class_name: processor_entry.options_class_name,
            resource: entry.resource,
            options: {}
          },
          status: "pending",
          priority: 1,
          scheduled_at: Time.now
        )
        # TODO: what to do with multiple job ids?
        # Update the entry with the job_id
        binding.pry
        Api[:idah].dataset.entries.update(
          id: entry.id,
          status: "processing",
          job_id: job_id
        )
      end
    end
  end
end
