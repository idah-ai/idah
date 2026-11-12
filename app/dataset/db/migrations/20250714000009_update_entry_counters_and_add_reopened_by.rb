# frozen_string_literal: true

# Adds reopened_by tracking columns to entries, and reworks the dataset entry
# counter trigger so:
#   - only "completed" entries count towards dataset progress (errored entries
#     are excluded from the completed and submitted counters),
#   - entering/leaving a state updates counters symmetrically — so reopening a
#     completed entry correctly rolls the dataset status back to in_progress.
Sequel.migration do
  up do
    alter_table(:entries) do
      add_column :reopened_by_id, :bigint, null: true, index: true
      add_column :reopened_by_email, String, null: true
    end

    run <<~SQL
      CREATE OR REPLACE FUNCTION update_dataset_entry_counters()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Handle INSERT
        IF (TG_OP = 'INSERT') THEN
          UPDATE datasets
          SET entries_total_count = entries_total_count + 1,
              entries_submitted_count =
                entries_submitted_count
                + CASE WHEN NEW.submitted_by_id IS NOT NULL AND NEW.status != 'errored' THEN 1 ELSE 0 END
          WHERE id = NEW.dataset_id;
          RETURN NEW;
        END IF;

        -- Handle UPDATE
        IF (TG_OP = 'UPDATE') THEN
          -- Only update if status changed
          IF (OLD.status != NEW.status) THEN
            -- Increment counters in dataset
            UPDATE datasets
            SET entries_completed_count =
                  entries_completed_count
                  + CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END
                  - CASE WHEN OLD.status = 'completed' THEN 1 ELSE 0 END,
                entries_in_progress_count =
                  entries_in_progress_count
                  + CASE WHEN NEW.status = 'in_progress' THEN 1 ELSE 0 END
                  - CASE WHEN OLD.status = 'in_progress' THEN 1 ELSE 0 END
            WHERE id = NEW.dataset_id;
          END IF;

          IF (OLD.submitted_by_id IS DISTINCT FROM NEW.submitted_by_id
              OR OLD.status IS DISTINCT FROM NEW.status) THEN
            UPDATE datasets
            SET entries_submitted_count =
                  entries_submitted_count
                  + CASE WHEN NEW.submitted_by_id IS NOT NULL AND NEW.status != 'errored' THEN 1 ELSE 0 END
                  - CASE WHEN OLD.submitted_by_id IS NOT NULL AND OLD.status != 'errored' THEN 1 ELSE 0 END
            WHERE id = NEW.dataset_id;
          END IF;

          RETURN NEW;
        END IF;

        -- Handle DELETE
        IF (TG_OP = 'DELETE') THEN
          UPDATE datasets
          SET entries_total_count = entries_total_count - 1,
              entries_completed_count = entries_completed_count - CASE WHEN OLD.status = 'completed' THEN 1 ELSE 0 END,
              entries_in_progress_count = entries_in_progress_count - CASE WHEN OLD.status = 'in_progress' THEN 1 ELSE 0 END,
              entries_submitted_count = entries_submitted_count - CASE WHEN OLD.submitted_by_id IS NOT NULL AND OLD.status != 'errored' THEN 1 ELSE 0 END
          WHERE id = OLD.dataset_id;
          RETURN OLD;
        END IF;

        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    SQL

    # Backfill counters for datasets that already contain entries (the trigger
    # only adjusts counters from now on).
    run <<~SQL
      UPDATE datasets
      SET entries_completed_count = counts.completed_count,
          entries_submitted_count = counts.submitted_count
      FROM (
        SELECT datasets.id AS dataset_id,
               COUNT(entries.id) FILTER (WHERE entries.status = 'completed') AS completed_count,
               COUNT(entries.id) FILTER (
                 WHERE entries.submitted_by_id IS NOT NULL
                   AND entries.status != 'errored'
               ) AS submitted_count
        FROM datasets
        LEFT JOIN entries ON entries.dataset_id = datasets.id
        GROUP BY datasets.id
      ) AS counts
      WHERE datasets.id = counts.dataset_id;
    SQL
  end

  down do
    alter_table(:entries) do
      drop_column :reopened_by_email
      drop_column :reopened_by_id
    end

    # Restore the original counter trigger (from the initial schema migration),
    # which counted errored entries as completed and never decremented the
    # submitted count.
    run <<~SQL
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
  end
end
