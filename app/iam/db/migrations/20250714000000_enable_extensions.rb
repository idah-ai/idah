# frozen_string_literal: true

# PostgreSQL extensions and the shared updated_at trigger function.
Sequel.migration do
  change do
    execute(%(CREATE EXTENSION IF NOT EXISTS "pg_trgm"))

    Migration::Timestamps.install_updated_at_function
  end
end
