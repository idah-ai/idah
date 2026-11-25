# frozen_string_literal: true

# S3 locations an admin registers for projects whose files must be kept apart.
# The secret is stored encrypted (see SecretBox); the location columns can't be
# changed once the target exists.
Sequel.migration do
  change do
    create_table(:storage_targets) do
      column :id, :uuid, primary_key: true # UUIDv7.generate

      column :name, String, null: false, unique: true

      column :endpoint, String, null: false
      column :region, String, null: true
      column :bucket, String, null: false
      column :prefix, String, null: false, default: ""
      # Path-style addressing (`endpoint/bucket/key`) for S3-compatible services
      # such as MinIO, Ceph or SeaweedFS, which don't resolve `bucket.endpoint`
      # names.
      column :path_style, TrueClass, null: false, default: false

      column :access_key_id, String, null: false
      # Set right after the insert, by a write that publishes no event, so the
      # secret never travels with the created event.
      column :secret_ciphertext, String, null: true

      column :organization_ids, "integer[]", null: false, default: Sequel.lit("'{}'::integer[]")

      column :enabled, TrueClass, null: false, default: false
      column :deleted_at, DateTime, null: true, index: true

      column :created_by, :bigint, null: true

      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :storage_targets)
  end
end
