# frozen_string_literal: true

Sequel.migration do
  up do
    # GIN index on jobs.arguments (jsonb) to speed up the JSONB containment /
    # key-existence checks used by the dataset-scoped export history filter.
    run "CREATE INDEX jobs_arguments_gin_idx ON jobs USING gin (arguments)"
  end

  down do
    run "DROP INDEX jobs_arguments_gin_idx"
  end
end
