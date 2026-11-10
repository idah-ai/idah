# frozen_string_literal: true

# PostgreSQL extensions, uuid_generate_v7() and the shared updated_at
# trigger function.
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
  end
end
