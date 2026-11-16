# frozen_string_literal: true

Sequel.migration do
  up do
    alter_table(:entries) { add_column :completed_at, DateTime, null: true }

    # Existing completed rows stay unknown. Only a new completion assigns a time.
    run <<~SQL
      CREATE FUNCTION set_entry_completed_at()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.status = 'completed' THEN
          IF TG_OP = 'UPDATE' THEN
            IF OLD.status = 'completed' THEN
              NEW.completed_at = OLD.completed_at;
              RETURN NEW;
            END IF;
          END IF;
          NEW.completed_at = CURRENT_TIMESTAMP;
        ELSE
          NEW.completed_at = NULL;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_set_entry_completed_at
      BEFORE INSERT OR UPDATE ON entries
      FOR EACH ROW EXECUTE FUNCTION set_entry_completed_at();
    SQL
  end

  down do
    run "DROP TRIGGER trg_set_entry_completed_at ON entries"
    run "DROP FUNCTION set_entry_completed_at()"
    alter_table(:entries) { drop_column :completed_at }
  end
end
