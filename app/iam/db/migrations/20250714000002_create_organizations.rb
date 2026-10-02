# frozen_string_literal: true

# Organizations.
Sequel.migration do
  change do
    create_table(:organizations) do
      primary_key :id, :bigserial
      column :name, String

      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :organizations)
  end
end
