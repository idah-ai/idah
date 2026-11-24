# frozen_string_literal: true

# The storage target a media file was written to. NULL is the default storage,
# which every existing file is in.
Sequel.migration do
  change do
    alter_table(:medias) do
      add_column :storage_target_id, :uuid, null: true, index: true
    end
  end
end
