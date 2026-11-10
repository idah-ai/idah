# frozen_string_literal: true

# Projects and their membership.
Sequel.migration do
  change do
    create_table(:projects) do
      column :id, :uuid, primary_key: true, default: Sequel.lit("uuid_generate_v7()")
      column :name, String, null: false, index: true

      column :description, String, null: true
      column :created_by_email, String, null: false

      index :created_by_email, opclass: :gin_trgm_ops, type: :gin

      column :organization_id, :bigint, null: false, index: true

      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :projects)

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

      # Added after the initial release.
      column :disabled_at, DateTime, null: true, index: true
    end
    Migration::Timestamps.trg_updated_at(self, :project_members)
  end
end
