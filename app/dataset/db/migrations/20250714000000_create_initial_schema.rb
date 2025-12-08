# frozen_string_literal: true

Sequel.migration do
  change do
    execute(%(CREATE EXTENSION IF NOT EXISTS "pg_trgm"))
    execute(%(CREATE EXTENSION IF NOT EXISTS "uuid-ossp"))
    execute(%(CREATE EXTENSION IF NOT EXISTS "pgcrypto"))

    # Credits goes to:
    # https://gist.githubusercontent.com/kjmph/5bd772b2c2df145aa645b837da7eca74/raw/3c410c9dfae89d1dfbcf4202f21974e2d30ed1d7/A_UUID_v7_for_Postgres.sql
    execute <<-SQL
      -- Based off IETF draft, https://datatracker.ietf.org/doc/draft-peabody-dispatch-new-uuid-format/
      create or replace function uuid_generate_v7()
      returns uuid
      as $$
      begin
        -- use random v4 uuid as starting point (which has the same variant we need)
        -- then overlay timestamp
        -- then set version 7 by flipping the 2 and 1 bit in the version 4 string
        return encode(
          set_bit(
            set_bit(
              overlay(uuid_send(gen_random_uuid())
                      placing substring(int8send(floor(extract(epoch from clock_timestamp()) * 1000)::bigint) from 3)
                      from 1 for 6
              ),
              52, 1
            ),
            53, 1
          ),
          'hex')::uuid;
      end
      $$
      language plpgsql
      volatile;

      -- Generate a custom UUID v8 with microsecond precision
      create or replace function uuid_generate_v8()
      returns uuid
      as $$
      declare
        timestamp    timestamptz;
        microseconds int;
      begin
        timestamp    = clock_timestamp();
        microseconds = (cast(extract(microseconds from timestamp)::int - (floor(extract(milliseconds from timestamp))::int * 1000) as double precision) * 4.096)::int;

        -- use random v4 uuid as starting point (which has the same variant we need)
        -- then overlay timestamp
        -- then set version 8 and add microseconds
        return encode(
          set_byte(
            set_byte(
              overlay(uuid_send(gen_random_uuid())
                      placing substring(int8send(floor(extract(epoch from timestamp) * 1000)::bigint) from 3)
                      from 1 for 6
              ),
              6, (b'1000' || (microseconds >> 8)::bit(4))::bit(8)::int
            ),
            7, microseconds::bit(8)::int
          ),
          'hex')::uuid;
      end
      $$
      language plpgsql
      volatile;
    SQL

    Migration::Timestamps.install_updated_at_function

    create_table(:projects) do
      column :id, :uuid, primary_key: true, default: Sequel.lit("uuid_generate_v7()")
      column :name, String, null: false, index: true

      column :description, String, null: true
      column :created_by_email, String, null: false

      index :created_by_email, opclass: :gin_trgm_ops, type: :gin

      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :projects)

    create_table(:datasets) do
      column :id, :uuid, primary_key: true, default: Sequel.lit("uuid_generate_v7()")

      foreign_key :project_id,
                  :projects,
                  type: :uuid,
                  null: false,
                  index: true,
                  on_delete: :cascade,
                  on_update: :cascade

      column :name, String, null: false, default: ""

      # Type of dataset
      column :modality, String, null: false

      column :labels, "text[]", null: false, default: "{}"

      # Workflow configuration
      column :workflow_configuration, :jsonb, null: false

      # Domain specific data, related to the modality
      column :labeling_configuration, :jsonb, null: false

      # Enable or disable the dataset
      column :enabled, TrueClass, null: false, default: true

      column :status, String, null: false, index: true, default: "pending"

      column :progress, Float, null: false, default: 0.0 # from 0.0 to 1.0

      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :datasets)

    create_table(:entries) do
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

      column :priority, Integer, null: false, default: 0, index: true

      column :resource, String, null: true
      # Related job for ingesting the entry.
      # Used to change the status of the entry, e.g. for videos.
      column :job_id, :bigint, null: true, index: true

      # current workflow step, e.g. "start", "annotate", "review", "export"
      column :wf_step, String, null: false, index: true, default: "start"

      # processing, pending, assigned, in_progress, completed, errored, ready
      column :status, String, null: false, index: true, default: "pending"

      column :assigned_to_id, :bigint, null: true, index: true

      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :entries)

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

      # Dimension of the annotation, e.g. coordinates or pixel mask.
      column :dimensions, :jsonb, text: true, null: false

      # The actual annotation data, e.g. category, label, source...
      column :annotation, :jsonb, text: true, null: false

      # Annotator information
      column :created_by_email, String, null: false

      index :created_by_email, opclass: :gin_trgm_ops, type: :gin
      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :annotations)

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

    create_table(:project_members) do
      primary_key :id, :bigserial

      foreign_key :project_id,
                  :projects,
                  type: :uuid,
                  null: false,
                  index: true,
                  on_delete: :cascade,
                  on_update: :cascade

      column :account_id, :bigint, null: false, index: true
      column :name, String
      column :email, String, null: false, index: true

      column :role, String, null: false

      column :invited_by_id, :bigint, null: false

      index [:project_id, :account_id]
      index [:project_id, :role]

      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :project_members)
  end
end
