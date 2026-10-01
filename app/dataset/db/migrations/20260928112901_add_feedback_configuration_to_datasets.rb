# frozen_string_literal: true

# Add feedback_configuration JSONB column to datasets.
# Stores feedback items as an object keyed by auto-generated key:
#   { "aB3kF9mN2q": { "label": "...", "description": "..." }, ... }
Sequel.migration do
  change do
    alter_table(:datasets) do
      add_column :feedback_configuration, :jsonb, null: true, default: Sequel.lit("'{}'::jsonb")
    end

    # Backfill existing rows
    from(:datasets).where(feedback_configuration: nil).update(feedback_configuration: Sequel.lit("'{}'::jsonb"))

    alter_table(:datasets) do
      set_column_not_null :feedback_configuration
    end
  end
end
