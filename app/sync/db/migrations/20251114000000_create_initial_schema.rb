# frozen_string_literal: true

Sequel.migration do
  change do
    execute(%(CREATE EXTENSION IF NOT EXISTS "pg_trgm"))

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
    SQL

    Migration::Timestamps.install_updated_at_function

    create_table(:jobs) do
      column :id, :uuid, primary_key: true, default: Sequel.lit("uuid_generate_v7()")

      column :job_class, String, null: false, index: true
      column :arguments, :jsonb, text: true, null: false

      column :priority, Integer, null: false, default: 0, index: true

      column :status, String, null: false, index: true, default: "pending"
      column :progress, Float, null: false, default: 0.0 # from 0.0 to 1.0
      column :retry_count, Integer, null: false, default: 0

      column :unicity,
             String,
             null: true,
             unique: true,
             comment: "Unique identifier for the job, used to prevent duplicate jobs."

      column :error, String

      column :scheduled_at, DateTime, null: false, index: true

      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :jobs)

    create_table(:exports) do
      primary_key :id, :bigserial

      column :job_id, String, null: false, index: true
      column :project_id, Integer, null: false, index: true
      column :created_by_id, Integer, null: false, index: true

      # These fields are populated when the export is ready,
      # and used to store the exported file information.
      column :file_id, String, null: true, index: true
      column :filename, String, null: true, index: true
      column :mime_type, String, null: true, index: true
      column :size, Integer, default: 0, null: false

      Migration::Timestamps.timestamps(self, updated_at: false)
    end
  end
end
