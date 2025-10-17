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

      processor_class = Registry.get(modality)

      return unless processor_class

      job = jobs.create(
        job_class: processor_class.name,
        arguments: { "entry_id" => entry_id },
        status: "pending",
        priority: 1,
        scheduled_at: Time.now
      )

      # Update the entry with the job_id
      Api[:idah].dataset.entries.update(
        id: entry.id,
        job_id: job.id,
        status: "processing"
      )
    end
  end
end
