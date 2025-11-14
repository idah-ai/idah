# frozen_string_literal: true

module Entry
  class Service < Verse::Service::Base
    use entries: Entry::Repository, datasets: Dataset::Repository

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

      dataset = datasets.find(record.dataset.id)

      unless dataset
        raise Verse::Error::ValidationFailed,
              "dataset not found to create an entry"
      end

      # With "as_user" access ensure account can "create" entry to the project
      access = auth_context.can?(:create, entries.class.resource)
      if access == :as_user && !ScopedQuery::Service.with_project_access?(
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

    def update(record)
      entries.update!(record.id, record.attributes)
      entries.find!(record.id)
    end

    def delete(id)
      entries.delete!(id)
    end

    def assign_member(id, assigned_to_id)
      entries.transaction do
        entries.update!(id, { assigned_to_id: })
        entries.find!(id)
      end
    end

    def submit(entry_id, **opts)
      entries.transaction do
        entry = entries.find!(entry_id, included: [:dataset])
        entry_workflow = entry.dataset.entry_workflow.new(entry, **opts)

        entry_workflow.submit!
        entries.update!(
          entry.id,
          {
            wf_step: entry_workflow.aasm.current_state.to_s,
            status: entry_workflow.aasm.current_state == :done ? "completed" : "in_progress"
          }
        )
        entries.find!(entry.id, included: [:dataset])
      end
    end

    def error(entry_id, **opts)
      entries.transaction do
        entry = entries.find!(entry_id, included: [:dataset])
        entry_workflow = entry.dataset.entry_workflow.new(entry, **opts)

        entry_workflow.error!
        entries.update!(
          entry.id,
          {
            wf_step: entry_workflow.aasm.current_state.to_s,
            status: "errored"
          }
        )
        entries.find!(entry.id, included: [:dataset])
      end
    end
  end
end
