# frozen_string_literal: true

# Adds a version counter to annotations and a change-history table.
#
# `annotation_changes` has no foreign keys by design: history outlives the
# annotation row (purging an entry cascades to its annotations but not to its
# history), and it keeps `account_id` after an account is removed. A retention
# and anonymization policy for those rows is an open question (see the
# annotation-change-history PR description).
Sequel.migration do
  up do
    # A constant default is a metadata-only change in Postgres, so this is safe
    # on a large annotations table. Existing rows start at version 1.
    alter_table(:annotations) do
      add_column :version, :integer, null: false, default: 1
    end

    create_table(:annotation_changes) do
      column :id, :uuid, primary_key: true, default: Sequel.lit("uuid_generate_v7()")
      column :annotation_id, :uuid, null: false # no FK: history outlives the annotation row
      column :entry_id, :uuid, null: false
      column :project_id, :uuid, null: false
      column :account_id, :bigint # null for system writes
      String :op, null: false                    # created | updated | deleted | restored
      column :version, :integer, null: false
      column :changes, :jsonb, null: false       # [[op, path, old, new], ...]
      DateTime :changed_at, null: false

      check %(op IN ('created', 'updated', 'deleted', 'restored'))

      index %i[annotation_id version], unique: true
      index %i[entry_id changed_at]
    end
  end

  down do
    drop_table(:annotation_changes)

    alter_table(:annotations) do
      drop_column :version
    end
  end
end
