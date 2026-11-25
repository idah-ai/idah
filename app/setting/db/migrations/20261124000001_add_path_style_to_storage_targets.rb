# frozen_string_literal: true

# Path-style addressing (`endpoint/bucket/key`) for S3-compatible services such
# as MinIO, Ceph or SeaweedFS, which don't resolve `bucket.endpoint` names.
Sequel.migration do
  change do
    alter_table(:storage_targets) do
      add_column :path_style, TrueClass, null: false, default: false
    end
  end
end
