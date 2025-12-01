# frozen_string_literal: true

Sequel.migration do
  change do
    execute(%(CREATE EXTENSION IF NOT EXISTS "pg_trgm"))
    execute(%(CREATE EXTENSION IF NOT EXISTS "uuid-ossp"))

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

    create_table(:medias) do
      column :id, String, primary_key: true

      column :resource, String, null: false, index: true
      column :key, String, null: false, default: ""

      column :filename, String, null: false

      # unique index on key and id:
      index [:resource, :key], unique: true

      column :size, Integer, null: false
      column :mime_type, String, null: false

      column :created_by, Integer, index: true
      column :created_role, String

      column :public, TrueClass, null: false, default: false, index: true
      column :meta, :jsonb, null: false, default: "{}"

      column :project_id, String, index: true

      # Able to use LIKE on media key.
      index :key, opclass: :gin_trgm_ops, type: :gin

      Migration::Timestamps.timestamps(self, updated_at: false)
    end

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
  end
end
