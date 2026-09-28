# frozen_string_literal: true

# Annotations and their shape rows.
Sequel.migration do
  change do
    create_table(:annotations) do
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

      foreign_key :entry_id,
                  :entries,
                  type: :uuid,
                  null: false,
                  index: true,
                  on_delete: :cascade,
                  on_update: :cascade

      # Annotator information
      column :created_by_email, String, null: false

      index :created_by_email, opclass: :gin_trgm_ops, type: :gin
      Migration::Timestamps.timestamps(self)

      # The flattened annotation columns. They replaced the legacy `dimensions`
      # and `annotation` jsonb columns, which no longer exist.
      column :metadata, :jsonb

      column :shape_type, :text, null: false
      column :shape_args, :jsonb, null: false
      column :category, :text, null: false
      column :properties, :jsonb
      column :deleted_at, :timestamp
      column :deleted_by_email, :text

      index :deleted_at
      index :category
    end
    Migration::Timestamps.trg_updated_at(self, :annotations)

    create_table(:annotation_shape) do
      foreign_key :annotation_id,
                  :annotations,
                  type: :uuid,
                  null: false,
                  on_delete: :cascade,
                  on_update: :cascade

      column :key, :text, null: false
      column :value, :jsonb, null: false

      primary_key %i[annotation_id key]
    end
  end
end
