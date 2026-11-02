# frozen_string_literal: true

Sequel.migration do
  up do
    create_table(:entry_category_counts) do
      column :id, :uuid, primary_key: true, default: Sequel.lit("uuid_generate_v7()")
      column :entry_id, :uuid, null: false
      column :dataset_id, :uuid, null: false
      column :project_id, :uuid, null: false
      column :category, :text, null: false
      column :count, :integer, null: false

      constraint(:entry_category_counts_positive_count, Sequel.lit("count > 0"))
      index %i[entry_id category], unique: true
      index %i[dataset_id category]
      index %i[project_id category]
    end

    # This trigger owns cleanup during annotation and parent cascades. A second
    # FK cascade on this derived table would make hard-delete ordering ambiguous.
    run <<~SQL
      CREATE FUNCTION sync_entry_category_counts()
      RETURNS trigger AS $$
      DECLARE
        remove_old boolean := false;
        add_new boolean := false;
        key_changed boolean := false;
      BEGIN
        IF TG_OP = 'INSERT' THEN
          add_new := NEW.deleted_at IS NULL;
        ELSIF TG_OP = 'DELETE' THEN
          remove_old := OLD.deleted_at IS NULL;
        ELSE
          key_changed := ROW(OLD.entry_id, OLD.dataset_id, OLD.project_id, OLD.category)
            IS DISTINCT FROM ROW(NEW.entry_id, NEW.dataset_id, NEW.project_id, NEW.category);
          remove_old := OLD.deleted_at IS NULL AND (NEW.deleted_at IS NOT NULL OR key_changed);
          add_new := NEW.deleted_at IS NULL AND (OLD.deleted_at IS NOT NULL OR key_changed);
        END IF;

        IF remove_old THEN
          UPDATE entry_category_counts
          SET count = count - 1
          WHERE entry_id = OLD.entry_id AND category = OLD.category AND count > 1;

          IF NOT FOUND THEN
            DELETE FROM entry_category_counts
            WHERE entry_id = OLD.entry_id AND category = OLD.category AND count = 1;
          END IF;
        END IF;

        IF add_new THEN
          INSERT INTO entry_category_counts (entry_id, dataset_id, project_id, category, count)
          VALUES (NEW.entry_id, NEW.dataset_id, NEW.project_id, NEW.category, 1)
          ON CONFLICT (entry_id, category) DO UPDATE
          SET count = entry_category_counts.count + 1,
              dataset_id = EXCLUDED.dataset_id,
              project_id = EXCLUDED.project_id;
        END IF;

        IF TG_OP = 'DELETE' THEN
          RETURN OLD;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_sync_entry_category_counts
      AFTER INSERT OR UPDATE OF entry_id, dataset_id, project_id, category, deleted_at OR DELETE
      ON annotations FOR EACH ROW EXECUTE FUNCTION sync_entry_category_counts();
    SQL

    # CREATE TRIGGER holds the write lock until this migration commits, so the
    # snapshot backfill and incoming writes cannot count the same row twice.
    run <<~SQL
      INSERT INTO entry_category_counts (entry_id, dataset_id, project_id, category, count)
      SELECT entry_id, dataset_id, project_id, category, COUNT(*)::integer
      FROM annotations
      WHERE deleted_at IS NULL
      GROUP BY entry_id, dataset_id, project_id, category;
    SQL
  end

  down do
    run "DROP TRIGGER trg_sync_entry_category_counts ON annotations"
    run "DROP FUNCTION sync_entry_category_counts()"
    drop_table(:entry_category_counts)
  end
end
