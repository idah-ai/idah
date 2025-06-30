# frozen_string_literal: true

module Jobs
  class Record < Verse::Model::Record::Base
    field :id, type: Integer, primary: true
    field :job_class, type: String

    field :arguments, type: Hash

    field :priority, type: Integer
    field :status, type: String
    field :progress, type: Float

    field :retry_count, type: Integer
    field :error, type: String

    field :scheduled_at, type: Time

    field :created_at, type: Time
    field :updated_at, type: Time
  end

  class Repository < Verse::Sequel::Repository
    self.table = "jobs"
    self.resource = "medias:jobs"

    encoder :arguments, Verse::Sequel::JsonEncoder

    # Lock available jobs for processing, up to {count} jobs.
    # The jobs are locked for update and their status is set to "scheduled".
    #
    # @param count [Integer] the maximum number of jobs to lock
    # @param now [Time] the current time, used to filter jobs that are ready to be processed
    # @return [Array<Job>] the locked jobs. note that returned status is still "pending"
    #
    # @example
    #   jobs = repo.lock_available(5)
    #
    def lock_available(count = 1, now: Time.now)
      transaction do
        scope = table.for_update.skip_locked
        jobs = index(
          {
            status: "pending",
            scheduled_at__lte: now
          },
          sort: "-priority",
          items_per_page: count,
          scope:,
        )

        jobs.each do |job|
          update!(job.id, { status: "scheduled" })
        end

        jobs
      end
    end

    def next_scheduled_time
      table.select(
        Sequel.lit("min(scheduled_at)")
      ).where(
        status: "pending"
      ).first[:min]
    end
  end
end
