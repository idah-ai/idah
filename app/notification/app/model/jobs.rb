# frozen_string_literal: true

module Jobs
  class Record < Verse::Model::Record::Base
    type Resource::Notification::Jobs

    field :id, type: String, primary: true
    field :job_class, type: String, visible: false

    field :arguments, type: Hash

    field :priority, type: Integer, visible: false
    field :status, type: String
    field :progress, type: Float, visible: false

    field :retry_count, type: Integer
    field :error, type: String
    field :unicity, type: String, visible: false

    field :webhook_id, type: Integer
    field :http_code, type: Integer
    field :response, type: String

    field :scheduled_at, type: Time

    field :created_at, type: Time
    field :updated_at, type: Time
  end

  class Repository < Verse::Sequel::Repository
    self.table = "jobs"
    self.resource = Resource::Notification::Jobs

    RETENTION = 30 * 86_400
    STALE_AFTER = 10 * 60

    encoder :arguments, Verse::Sequel::JsonEncoder

    # Lock available jobs for processing, up to {count} jobs.
    # The jobs are locked for update and their status is set to "running".
    # Note that returned records still show status "pending".
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
          update!(job.id, { status: "running" })
        end

        jobs
      end
    end

    event(name: "completed")
    def complete(id)
      no_event do # avoid updated event being dispatched
        update!(id, { status: "completed", progress: 1.0 })
      end
    end

    event(name: "rescheduled")
    def reschedule(id, scheduled_at: nil, error: nil)
      no_event do # avoid updated event being dispatched
        attr = {
          status: "pending",
          scheduled_at: scheduled_at || Time.now,
          retry_count: Sequel.lit("retry_count + 1"),
          progress: 0.0,
          error:
        }.compact

        update!(id, attr)
      end
    end

    event(name: "errored")
    def error(id, error)
      no_event do # avoid updated event being dispatched
        update!(
          id,
          {
            status: "errored",
            error: error,
            progress: 0.0
          }
        )
      end
    end

    def next_scheduled_time
      table.select(
        Sequel.lit("min(scheduled_at)")
      ).where(
        status: "pending"
      ).first[:min]
    end

    # Inserts a job; a job with the same unicity already queued wins.
    def enqueue(attributes)
      with_db_mode(:rw) { table.insert_conflict(target: :unicity).insert(encode(attributes)) }
    end

    # Jobs left "running" by a process that died are picked up again.
    def reclaim_stale
      table.where(status: "running").where { updated_at < Time.now - STALE_AFTER }.update(status: "pending")
    end

    def cleanup
      table.where(status: %w[completed errored]).where { updated_at < Time.now - RETENTION }.delete
    end

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }
        scope.own? {
          table.where(
            Sequel.lit(
              "EXISTS (SELECT 1 FROM webhooks WHERE webhooks.id = jobs.webhook_id AND webhooks.account_id = ?)",
              auth_context.metadata[:id]
            )
          )
        }
      end
    end
  end
end
