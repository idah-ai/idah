# frozen_string_literal: true

Sequel.migration do
  up do
    alter_table(:entries) do
      add_column :reopened_by_id, :bigint, null: true, index: true
      add_column :reopened_by_email, String, null: true
    end

    # Fix the entry counter trigger so it also decrements completed/errored
    # counters when an entry leaves that status (needed for re-opening entries).
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
            SET entries_completed_count =
                  entries_completed_count
                  + CASE WHEN NEW.status IN ('completed', 'errored') THEN 1 ELSE 0 END
                  - CASE WHEN OLD.status IN ('completed', 'errored') THEN 1 ELSE 0 END,
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

  down do
    alter_table(:entries) do
      drop_column :reopened_by_email
      drop_column :reopened_by_id
    end

    # Restore the original trigger function (no completed/errored decrement on
    # status change — suitable for a down-only revert).
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