# frozen_string_literal: true

# Note feeds and their comments.
Sequel.migration do
  change do
    create_table(:note_feeds) do
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

      # Optional annotation reference, based on the anchor type.
      foreign_key :annotation_id,
                  :annotations,
                  type: :uuid,
                  null: true,
                  index: true,
                  on_delete: :cascade,
                  on_update: :cascade

      column :created_by_email, String, null: false

      # Position anchor, or annotation reference
      column :anchor_type, String, null: false, index: true

      # position on the entry, e.g. coordinates in the image, timestamp etc.
      column :position, :jsonb

      # Pending or resolved.
      column :status, String, null: false, index: true, default: "pending"

      column :content_md, String, null: false
      column :edited_at, DateTime, null: true

      index :created_by_email, opclass: :gin_trgm_ops, type: :gin

      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :note_feeds)

    create_table(:note_comments) do
      column :id, :uuid, primary_key: true, default: Sequel.lit("uuid_generate_v7()")

      foreign_key :note_feed_id,
                  :note_feeds,
                  type: :uuid,
                  null: false,
                  index: true,
                  on_delete: :cascade,
                  on_update: :cascade

      column :content_md, String, null: false

      column :created_by_email, String, null: false
      column :edited_at, DateTime, null: true

      index :created_by_email, opclass: :gin_trgm_ops, type: :gin
      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :note_comments)
  end
end
