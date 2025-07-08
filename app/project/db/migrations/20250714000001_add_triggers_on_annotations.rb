Sequel.migration do
  change do
    # Trigger updated_at on entries whenever an annotation is inserted or updated:
    execute(<<~SQL)
      CREATE OR REPLACE FUNCTION update_entry_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE entries
        SET updated_at = NOW()
        WHERE id = NEW.entry_id;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_update_entry_on_annotation_change
      AFTER INSERT OR UPDATE ON annotations
      FOR EACH ROW
      EXECUTE FUNCTION update_entry_timestamp();
    SQL

    # Trigger updated_at on datasets whenever an entries is inserted or updated:
    execute(<<~SQL)
      CREATE OR REPLACE FUNCTION update_dataset_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE datasets
        SET updated_at = NOW()
        WHERE id = NEW.dataset_id;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_update_dataset_on_entry_change
      AFTER INSERT OR UPDATE ON entries
      FOR EACH ROW
      EXECUTE FUNCTION update_dataset_timestamp();
    SQL

    # Trigger updated_at on projects whenever a dataset is inserted or updated:
    execute(<<~SQL)
      CREATE OR REPLACE FUNCTION update_project_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE projects
        SET updated_at = NOW()
        WHERE id = NEW.project_id;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_update_project_on_dataset_change
      AFTER INSERT OR UPDATE ON datasets
      FOR EACH ROW
      EXECUTE FUNCTION update_project_timestamp();
    SQL
  end
end