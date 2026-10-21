# frozen_string_literal: true

module Entry
  class Service < Verse::Service::Base
    use entries: Entry::Repository,
        datasets: Dataset::Repository,
        projects: Project::Repository,
        project_members: ProjectMember::Repository,
        annotations: Annotation::Repository
    use_system system_datasets_repo: Dataset::Repository, system_entries_repo: Entry::Repository

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      entries.index(
        filter,
        included:,
        page:,
        items_per_page:,
        sort:,
        query_count:
      )
    end

    def show(id, included: [])
      entries.find!(id, included:)
    end

    def create(record)
      attributes = record.attributes

      # Validate required relationships and fields
      unless record.dataset
        raise Verse::Error::ValidationFailed,
              "dataset relationship is required to create an entry"
      end

      unless attributes[:resource]
        raise Verse::Error::ValidationFailed,
              "resource field is required to create an entry"
      end

      # Ensure entry with same resource does not already exist
      if entries.find_by({ resource: attributes[:resource] })
        raise Verse::Error::ValidationFailed,
              "Entry with resource #{attributes[:resource]} already exists"
      end

      # Organization Owner can find the dataset in their scope
      # Project Owner can find the dataset in their projects
      # Annotator and Reviewer can find the dataset only if entry is assigned to them
      dataset = datasets.find(record.dataset.id)

      unless dataset
        raise Verse::Error::ValidationFailed,
              "dataset not found to create an entry"
      end

      # Creating an entry requires effective rank >= project_owner on the project.
      ensure_project_owner!(dataset.project_id)

      # Assign attributes
      attributes[:id] = record.id || UUIDv7.generate
      attributes[:project_id] = dataset.project_id
      attributes[:dataset_id] = dataset.id

      entries.transaction do
        id = entries.create(attributes)
        entries.find!(id)
      end
    end

    def mark_entries_status_as(job_id, status)
      entries.transaction do
        entry = entries.find_by!({ job_id:, status: "processing" })
        entries.mark_entries_status_as(job_id, status)
        system_datasets_repo.update_progress!(entry.dataset_id)
      end
    end

    def complete_entry_processing(job_id)
      system_entries_repo.transaction do
        entry = system_entries_repo.find_by!({ job_id:, status: "processing" }, included: [:dataset])
        entry_workflow = entry.dataset.entry_workflow.new(system_entries_repo, entry)
        entry_workflow.submit!
        system_datasets_repo.update_progress!(entry.dataset.id)
      end
    end

    def update(record)
      entries.update!(record.id, record.attributes)
      entries.find!(record.id)
    end

    def delete(id)
      entries.transaction do
        entry = entries.find!(id)
        if %w[in_progress completed].include?(entry.status)
          raise Verse::Error::Unauthorized, "Unable to delete in progress or completed entry"
        end

        dataset_id = entry.dataset_id
        entries.delete!(id)
        system_datasets_repo.update_progress!(dataset_id)
      end
    end

    def assign_member(id, assigned_to_id)
      entries.transaction do
        entry = entries.find!(id)
        member = project_members.find_by({ account_id: assigned_to_id, project_id: entry.project_id })
        entries.assign(id, assigned_to_id, member&.email)
        system_datasets_repo.update_progress!(entry.dataset_id)
        entries.find!(id)
      end
    end

    def unassign_member(id)
      entries.transaction do
        entries.unassign(id)
        entry = entries.find!(id)
        system_datasets_repo.update_progress!(entry.dataset_id)
        entry
      end
    end

    def select(entry_id)
      entries.transaction do
        account_id = auth_context.metadata[:id]
        entry = entries.find!(entry_id)

        if entry.assigned_to_id && entry.assigned_to_id != account_id
          raise Verse::Error::Unauthorized,
                "You are not assigned to this entry"
        end

        # Use read scope when updating as anyone with read access can select
        entries.select(entry.id)
        system_datasets_repo.update_progress!(entry.dataset_id)
        entries.find!(entry.id)
      end
    end

    def submit(entry_id, **opts)
      # check self reviewing here, reject
      entries.transaction do
        entry = entries.find!(entry_id, included: [:dataset])
        entry_workflow = entry.dataset.entry_workflow.new(entries, entry, **opts)
        entry_workflow.submit!

        # Update dataset progress after entry status change
        # Use system dataset repo to avoid permission issues with update
        system_datasets_repo.update_progress!(entry.dataset.id)

        # Use system entry repo as annotator/reviewer may not have read access after submission
        system_entries_repo.find!(entry.id, included: [:dataset])
      end
    end

    def error(entry_id, **opts)
      entries.transaction do
        entry = entries.find!(entry_id, included: [:dataset])
        entry_workflow = entry.dataset.entry_workflow.new(entries, entry, **opts)

        entry_workflow.error!
        entries.error(
          entry.id,
          {
            wf_step: entry_workflow.aasm.current_state.to_s,
            status: "errored"
          }
        )

        # Update dataset progress after entry status change
        # Use system dataset repo to avoid permission issues with update
        system_datasets_repo.update_progress!(entry.dataset.id)

        entries.find!(entry.id, included: [:dataset])
      end
    end

    def reopen(entry_id, target_step:)
      entries.transaction do
        entry = entries.find!(entry_id, included: [:dataset])

        unless entry.status == "completed"
          raise Verse::Error::ValidationFailed, "Only completed entries can be reopened"
        end

        workflow = entry.dataset.entry_workflow.new(entries, entry)
        target = target_step.to_s

        unless workflow.reopenable_steps.map(&:to_s).include?(target)
          raise Verse::Error::ValidationFailed, "Invalid reopen target step \"#{target}\""
        end

        entries.reopen(
          entry.id,
          {
            wf_step: target,
            status: "pending",
            assigned_to_id: nil,
            assigned_to_email: nil,
            reopened_by_id: auth_context.metadata[:id],
            reopened_by_email: auth_context.metadata[:email]
          }
        )

        # Dataset status changes to in_progress if
        # it was previously completed.
        system_datasets_repo.update_progress!(entry.dataset_id)

        entries.find!(entry.id, included: [:dataset])
      end
    end

    def reopen_targets(entry_id)
      entry = entries.find!(entry_id, included: [:dataset])

      entry.dataset.entry_workflow.new(entries, entry).reopenable_steps.map(&:to_s)
    end

    def unassign_account_entries(account_id, project_id)
      system_entries_repo.chunked_index({ assigned_to_id: account_id, project_id: }).each do |entry|
        system_entries_repo.unassign(entry.id)
      end
    end

    def duplicate_entries(dataset_id, duping_dataset_id:, entry_ids: nil, with_annotations: false)
      dataset = datasets.find(dataset_id)

      unless dataset
        raise Verse::Error::ValidationFailed,
              "dataset not found to duplicate entries"
      end

      # Creating an entry requires effective rank >= project_owner on the project.
      ensure_project_owner!(dataset.project_id)

      duping_entries = if entry_ids
                         # INFO: also filter with duping_dataset_id to ensure the entries are in the duping dataset
                         system_entries_repo.chunked_index({ id: entry_ids, dataset_id: duping_dataset_id })
                       else
                         system_entries_repo.chunked_index({ dataset_id: duping_dataset_id })
                       end

      duping_entries.each do |duping_entry|
        # Skip sources whose media is still processing — duplicating them would
        # mean riding the original's in-flight job, which we deliberately avoid.
        # Only already-processed entries (media job done, advanced off "start")
        # are duplicated; their media is reused via the shared resource so no new
        # processing job runs (no created event).
        next if duping_entry.status == "processing"

        now = Time.now
        entry_id = UUIDv7.generate
        attributes = {
          **duping_entry.fields,
          id: entry_id,
          project_id: duping_entry.project_id,
          dataset_id: dataset_id,
          job_id: duping_entry.job_id,
          wf_step: "start",
          status: "pending",
          assigned_to_id: nil,
          submitted_by_id: nil,
          reviewed_by_id: nil,
          created_at: now,
          updated_at: now,
        }

        begin
          entries.transaction do
            # No event: a duplicate must never trigger its own processing job.
            entries.no_event { entry_id = entries.create(attributes) }

            # Advance the duplicate off "start" right away — its media is already
            # processed, so we drive the workflow instead of waiting on a job.
            entry = system_entries_repo.find!(entry_id, included: [:dataset])
            entry.dataset.entry_workflow.new(system_entries_repo, entry).submit!
            system_datasets_repo.update_progress!(entry.dataset_id)

            if with_annotations
              annotations.chunked_index({ entry_id: duping_entry.id }).each do |annotation|
                annotations.create(
                  {
                    **annotation.fields,
                    id: UUIDv7.generate,
                    project_id: duping_entry.project_id,
                    dataset_id: dataset_id,
                    entry_id: entry_id,
                    created_at: now,
                    updated_at: now,
                  }
                )
              end
            end
          end
        rescue StandardError => e
          # Best-effort duplication: skip the failed entry and continue the batch.
          Verse.logger&.error do
            "duplicate_entries: skipped source entry #{duping_entry.id}: #{e.message}"
          end
          next
        end
      end
    end

    private

    # Creating an entry requires effective rank >= project_owner on the project.
    # Decides on the resolver so an org_owner with a membership on a foreign
    # project is evaluated with their membership role.
    def ensure_project_owner!(project_id)
      effective_rank = ProjectAccess::Service.effective_rank(
        auth_context, project_id, action: :create, resource: entries.class.resource
      )
      return if effective_rank && effective_rank >= RoleHierarchy.rank("project_owner")

      raise Verse::Error::Unauthorized,
            "You do not have permission to create entry on this project"
    end
  end
end
