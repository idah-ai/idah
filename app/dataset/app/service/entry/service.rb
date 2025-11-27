# frozen_string_literal: true

module Entry
  class Service < Verse::Service::Base
    use entries: Entry::Repository
    use_system datasets: Dataset::Repository

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
      attr = record.attributes

      attr[:id] = record.id || UUIDv7.generate

      entries.transaction do
        unless attr[:resource]
          raise Verse::Error::ValidationFailed,
                "resource is required to create an entry"
        end

        if entries.find_by({ resource: attr[:resource] })
          raise Verse::Error::ValidationFailed,
                "Entry with resource #{attr[:resource]} already exists"
        end

        unless record.dataset
          raise Verse::Error::ValidationFailed,
                "dataset is required to create an entry"
        end

        attr[:dataset_id] = record.dataset.id

        id = entries.create(attr)

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
      entries.delete(id)
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

        # Update dataset progress after entry status change
        datasets.update_progress!(entry.dataset.id)

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
