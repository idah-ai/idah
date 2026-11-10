# frozen_string_literal: true

# Entries, and the trigger that maintains the dataset counters.
Sequel.migration do
  change do
    create_table(:entries) do
      column :id, :uuid, primary_key: true, default: Sequel.lit("uuid_generate_v7()")

      foreign_key :project_id,
                  :projects,
                  type: :uuid,
                  null: false,
                  index: true,
                  on_delete: :cascade,
                  on_update: :cascade

      foreign_key :dataset_id,
                  :datasets,
                  type: :uuid,
                  null: false,
                  index: true,
                  on_delete: :cascade,
                  on_update: :cascade

      column :priority, Integer, null: false, default: 0, index: true

      column :resource, String, null: true
      # Related job for ingesting the entry.
      # Used to change the status of the entry, e.g. for videos.
      column :job_id, :uuid, null: true, index: true

      # current workflow step, e.g. "start", "annotate", "review", "export"
      column :wf_step, String, null: false, index: true, default: "start"

      # processing, pending, assigned, in_progress, completed, errored, ready
      column :status, String, null: false, index: true, default: "pending"

      column :assigned_to_id, :bigint, null: true, index: true
      column :submitted_by_id, :bigint, null: true, index: true
      column :reviewed_by_id, :bigint, null: true, index: true

      Migration::Timestamps.timestamps(self)

      # Added after the initial release.
      column :name, String, null: true
      column :assigned_to_email, String, null: true
      column :submitted_by_email, String, null: true
      column :reviewed_by_email, String, null: true
    end
    Migration::Timestamps.trg_updated_at(self, :entries)

    # Create trigger function to update datasets counters on entry changes
    execute <<~SQL
      CREATE OR REPLACE FUNCTION update_dataset_entry_counters()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Handle INSERT
        IF (TG_OP = 'INSERT') THEN
          UPDATE datasets
          SET entries_total_count = entries_total_count + 1,
              entries_submitted_count =
                entries_submitted_count
                + CASE WHEN NEW.submitted_by_id IS NOT NULL THEN 1 ELSE 0 END
          WHERE id = NEW.dataset_id;
          RETURN NEW;
        END IF;

        -- Handle UPDATE
        IF (TG_OP = 'UPDATE') THEN
          -- Only update if status changed
          IF (OLD.status != NEW.status) THEN
            -- Increment counters in dataset
            UPDATE datasets
            SET entries_completed_count = entries_completed_count + CASE WHEN NEW.status = 'completed' OR NEW.status = 'errored' THEN 1 ELSE 0 END,
                entries_in_progress_count =
                  entries_in_progress_count
                  + CASE WHEN NEW.status = 'in_progress' THEN 1 ELSE 0 END
                  - CASE WHEN OLD.status = 'in_progress' THEN 1 ELSE 0 END
            WHERE id = NEW.dataset_id;
          END IF;

          -- Count the entry the first time it gets submitted, never decrement
          IF (OLD.submitted_by_id IS NULL AND NEW.submitted_by_id IS NOT NULL) THEN
            UPDATE datasets
            SET entries_submitted_count = entries_submitted_count + 1
            WHERE id = NEW.dataset_id;
          END IF;

          RETURN NEW;
        END IF;

        -- Handle DELETE
        IF (TG_OP = 'DELETE') THEN
          UPDATE datasets
          SET entries_total_count = entries_total_count - 1,
              entries_completed_count = entries_completed_count - CASE WHEN OLD.status = 'completed' OR OLD.status = 'errored' THEN 1 ELSE 0 END,
              entries_in_progress_count = entries_in_progress_count - CASE WHEN OLD.status = 'in_progress' THEN 1 ELSE 0 END,
              entries_submitted_count = entries_submitted_count - CASE WHEN OLD.submitted_by_id IS NOT NULL THEN 1 ELSE 0 END
          WHERE id = OLD.dataset_id;
          RETURN OLD;
        END IF;

        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    SQL

    # Create trigger on entries table
    execute <<~SQL
      CREATE TRIGGER trg_update_dataset_entry_counters
      AFTER INSERT OR UPDATE OR DELETE ON entries
      FOR EACH ROW
      EXECUTE FUNCTION update_dataset_entry_counters();
    SQL
  end
end
