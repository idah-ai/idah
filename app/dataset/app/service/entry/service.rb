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

      # With "as_user" access ensure account can "create" entry to the project
      if auth_context.can?(:create, entries.class.resource) == :as_user &&
         ScopedQuery::Service.without_project_access?(
           auth_context.metadata[:id],
           dataset.project_id,
           ["project_owner"]
         )
        raise Verse::Error::Unauthorized,
              "You do not have permission to create entry on this project"
      end

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
      entries.mark_entries_status_as(job_id, status)
    end

    def complete_entry_processing(job_id)
      system_entries_repo.transaction do
        # A single job can back several entries: a duplicated entry that was still
        # processing shares the original's job_id (see #duplicate_entries), so the
        # completion advances the original and every duplicate riding the same job.
        # Materialise first, then advance — we mutate the very rows we query.
        processing_entries = []
        system_entries_repo.chunked_index(
          { job_id:, status: "processing" }, included: [:dataset]
        ).each { |entry| processing_entries << entry }

        dataset_ids = processing_entries.map do |entry|
          entry.dataset.entry_workflow.new(system_entries_repo, entry).submit!
          entry.dataset.id
        end

        dataset_ids.uniq.each { |id| system_datasets_repo.update_progress!(id) }
      end
    end

    def update(record)
      entries.update!(record.id, record.attributes)
      entries.find!(record.id)
    end

    def delete(id)
      entry = entries.find!(id)
      if %w[in_progress completed].include?(entry.status)
        raise Verse::Error::Unauthorized, "Unable to delete in progress or completed entry"
      end

      entries.delete!(id)
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

      # With "as_user" access ensure account can "create" entry to the project
      if auth_context.can?(:create, entries.class.resource) == :as_user &&
         ScopedQuery::Service.without_project_access?(
           auth_context.metadata[:id],
           dataset.project_id,
           ["project_owner"]
         )
        raise Verse::Error::Unauthorized,
              "You do not have permission to create entry on this project"
      end

      duping_entries = if entry_ids
                         # INFO: also filter with duping_dataset_id to ensure the entries are in the duping dataset
                         system_entries_repo.chunked_index({ id: entry_ids, dataset_id: duping_dataset_id })
                       else
                         system_entries_repo.chunked_index({ dataset_id: duping_dataset_id })
                       end

      duping_entries.each do |duping_entry|
        # An entry only leaves "start" once its media job completes, so a source
        # still at "start" is not processed yet. Duplicated media shares the
        # original's resource, so we never re-run the processor (no created event):
        #   - processed source  -> advance the duplicate off "start" right away.
        #   - unprocessed source -> copy the in-flight job_id (+ "processing"
        #     status) so the duplicate is advanced together with the original when
        #     that job completes (see #complete_entry_processing).
        #
        # TODO: two known low-probability gaps left unhandled for now (not worth
        # the complexity yet):
        #   1. Race window: if the source's job completes *between* reading it here
        #      and committing this duplicate, the completion fan-out can miss the
        #      uncommitted duplicate, leaving it stuck at "start"/"processing". A
        #      post-loop re-check (re-read the source; if it advanced and the dupe
        #      is still "processing", advance the dupe) would close it.
        #   2. Truly-fresh source ("start" with job_id nil): nothing in flight to
        #      ride, so the duplicate would never advance. Such a source's dupe
        #      should instead emit its own created event to get its own job.
        source_processed = duping_entry.wf_step != "start"

        now = Time.now
        entry_id = UUIDv7.generate
        attributes = {
          **duping_entry.fields,
          id: entry_id,
          project_id: duping_entry.project_id,
          dataset_id: dataset_id,
          job_id: duping_entry.job_id,
          wf_step: "start",
          status: source_processed ? "pending" : "processing",
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

            if source_processed
              entry = system_entries_repo.find!(entry_id, included: [:dataset])
              entry.dataset.entry_workflow.new(system_entries_repo, entry).submit!
              system_datasets_repo.update_progress!(entry.dataset_id)
            end

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
  end
end
