# frozen_string_literal: true

Sequel.migration do
  change do
    Migration::Timestamps.install_updated_at_function

    create_table(:project_members) do
      primary_key :id, :bigserial

      foreign_key :project_id, :projects, type: :uuid, null: false, index: true, on_delete: :cascade, on_update: :cascade

      column :account_id, :bigint, index: true, null: false
      column :name, String
      column :email, String, index: true

      column :role, String, null: false

      column :invited_by_id, :bigint, null: false
      
      index [:project_id, :account_id]
      index [:project_id, :role]

      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :project_members)
  end
end