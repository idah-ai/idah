# frozen_string_literal: true

Sequel.migration do
  up do
    alter_table(:datasets) do
      add_column :entries_submitted_count, Integer, null: false, default: 0
    end

    # Maintain entries_submitted_count alongside the existing dataset counters.
    # It counts entries that have been submitted at least once (submitted_by_id
    # set), so the counter is increment-only on update: it fires the first time
    # submitted_by_id becomes non-NULL and is never decremented if it is later
    # cleared.
    #
    # NOTE: existing datasets keep entries_submitted_count = 0 until the count is
    # corrected on the server; this migration only wires up future maintenance.
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
  end

  down do
    # Restore the original trigger function (without submitted-count handling).
    execute <<~SQL
      CREATE OR REPLACE FUNCTION update_dataset_entry_counters()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Handle INSERT
        IF (TG_OP = 'INSERT') THEN
          UPDATE datasets
          SET entries_total_count = entries_total_count + 1
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
          RETURN NEW;
        END IF;

        -- Handle DELETE
        IF (TG_OP = 'DELETE') THEN
          UPDATE datasets
          SET entries_total_count = entries_total_count - 1,
              entries_completed_count = entries_completed_count - CASE WHEN OLD.status = 'completed' OR OLD.status = 'errored' THEN 1 ELSE 0 END,
              entries_in_progress_count = entries_in_progress_count - CASE WHEN OLD.status = 'in_progress' THEN 1 ELSE 0 END
          WHERE id = OLD.dataset_id;
          RETURN OLD;
        END IF;

        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    SQL

    alter_table(:datasets) do
      drop_column :entries_submitted_count
    end
  end
end
