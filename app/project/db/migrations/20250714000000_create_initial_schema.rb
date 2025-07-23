# frozen_string_literal: true

Sequel.migration do
  change do
    execute(%(CREATE EXTENSION IF NOT EXISTS "pg_trgm"))

    Migration::Timestamps.install_updated_at_function

    create_table(:projects) do
      column :id, :uuidv7, primary_key: true
      column :name, String, null: false, index: true

      column :description, String, null: true
      column :created_by_id, :bigint, null: true, index: true

      Migration::Timestamps.timestamps(self)
    end

    Migration::Timestamps.trg_updated_at(self, :projects)

    create_table(:datasets) do
      column :id, :bigserial, primary_key: true

      foreign_key :project_id,
                  :projects,
                  type: :bigint,
                  null: false,
                  index: true,
                  on_delete: :cascade,
                  on_update: :cascade

      # Type of dataset
      column :topology, String, null: false

      column :labels, "text[]", null: false, default: "{}"

      # Domain specific data, related to the topology
      column :configuration, :jsonb, text: true, null: false

      column :status, String, null: false, index: true, default: "pending"
      column :progress, Float, null: false, default: 0.0 # from 0.0 to 1.0

      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :datasets)

    create_table(:entries) do
      column :id, :bigserial, primary_key: true

      foreign_key :dataset_id,
                  :datasets,
                  type: :bigint,
                  null: false,
                  index: true,
                  on_delete: :cascade,
                  on_update: :cascade

      column :priority, Integer, null: false, default: 0, index: true

      column :file_url, String, null: true

      # current workflow step, e.g. "start", "annotate", "review", "export"
      column :wf_step, String, null: false, index: true, default: "start"

      # pending, assigned, in_progress, completed, errored
      column :status, String, null: false, index: true, default: "pending"

      column :assigned_to_id, :bigint, null: true, index: true

      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :entries)

    create_table(:annotations) do
      column :id, :bigserial, primary_key: true

      foreign_key :entry_id, :entries, type: :bigint, null: false, index: true

      # Type of annotation, e.g. "bounding_box", "polygon", "timerange" etc.
      column :type, String, null: false, index: true # video_bounding_box

      # Dimension of the annotation, e.g. coordinates or pixel mask.
      column :dimensions, :jsonb, text: true, null: false

      # The actual annotation data, e.g. category, label, source...
      column :annotation, :jsonb, text: true, null: false

      # Annotator information
      column :created_by_id, :bigint, null: false, index: true

      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :annotations)

    create_table(:note_feeds) do
      column :id, :bigserial, primary_key: true

      foreign_key :annotation_id, :annotations, type: :bigint, null: false, index: true
      column :created_by_id, :bigint, null: false, index: true

      # Position anchor, or annotation reference
      column :anchor_type, String, null: false, index: true
      # position on the annotation, e.g. coordinates in the image, timestamp etc.
      column :position, :jsonb

      # Pending or resolved.
      column :status, String, null: false, index: true, default: "pending"

      column :content_md, String, null: false
      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :note_feeds)

    create_table(:note_comments) do
      column :id, :bigserial, primary_key: true

      foreign_key :note_feed_id, :note_feeds, type: :bigint, null: false, index: true

      column :is_edited, :boolean, null: false, default: false
      column :content_md, String, null: false

      column :created_by_id, :bigint, null: false, index: true
      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :note_comments)
  end
end
