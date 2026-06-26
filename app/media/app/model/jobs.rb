# frozen_string_literal: true

module Jobs
  class Record < Verse::Model::Record::Base
    type Resource::Media::Jobs

    field :id, type: String, primary: true
    field :job_class, type: String

    field :arguments, type: Hash

    field :priority, type: Integer
    field :status, type: String
    field :progress, type: Float

    field :retry_count, type: Integer
    field :error, type: String
    field :unicity, type: String

    field :scheduled_at, type: Time

    field :created_at, type: Time
    field :updated_at, type: Time
  end

  class Repository < Verse::Sequel::Repository
    self.table = "jobs"
    self.resource = Resource::Media::Jobs

    encoder :arguments, Verse::Sequel::JsonEncoder

    def scoped(action)
      auth_context.can!(action, self.class.resource) do |scope|
        scope.all? { table }

        scope.as_org_owner? { scope_with_org_projects_medias }

        scope.as_user? { scope_with_member_projects_medias }
      end
    end

    # Lock available jobs for processing, up to {count} jobs.
    # The jobs are locked for update and their status is set to "running".
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
          update!(job.id, { status: "running" })
        end

        jobs
      end
    end

    event(name: "progressed")
    def update_progress(id, value)
      no_event do # avoid updated event being dispatched
        update!(id, { progress: value })
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

    # True when a *completed* job has already produced the outputs for this
    # resource. Used to skip re-processing when an entry points at media that is
    # already processed (e.g. a duplicated entry sharing the original's resource).
    #
    # Only "completed" jobs count, so a crashed or in-flight job never matches —
    # retries of a partially-processed resource still process normally.
    # +except_job_id+ excludes a job from matching itself.
    def processed_resource?(resource, except_job_id: nil)
      ds = table.where(status: "completed")
                .where(Sequel.lit("arguments->>'resource' = ?", resource))
      ds = ds.exclude(id: except_job_id) if except_job_id
      !ds.empty?
    end

    private

    def scope_with_org_projects_medias
      org_ids = auth_context.custom_scopes[:org]

      project_ids = Api[:idah].dataset.projects.index_all(
        filter: { organization_id: org_ids },
        fields: { "dataset:projects": ["id"] }
      ).map(&:id)

      frag = <<-SQL
        EXISTS (
          SELECT 1
          FROM medias
          WHERE medias.resource = (arguments->>'resource')
            AND medias.project_id IN :project_ids
        )
      SQL

      table.where(Sequel.lit(frag, project_ids:))
    end

    def scope_with_member_projects_medias
      account_id = auth_context.metadata[:id]

      project_ids = Api[:idah].dataset.project_members.index_all(
        filter: { account_id:, enabled: true },
        fields: { "dataset:project_members": ["project_id"] }
      ).map(&:project_id).uniq

      frag = <<-SQL
        EXISTS (
          SELECT 1
          FROM medias
          WHERE medias.resource = (arguments->>'resource')
            AND medias.project_id IN :project_ids
        )
      SQL

      table.where(Sequel.lit(frag, project_ids:))
    end
  end
end
