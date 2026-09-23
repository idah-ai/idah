# frozen_string_literal: true

# Plugin discovery can register multiple rows with the same (name, version)
# pointing at different source_paths, making Plugin::Record#path resolution
# ambiguous. Enforce uniqueness on (name, version).
#
# NOTE: if duplicate (name, version) rows already exist this migration will
# fail — dedupe them manually before running it (a loud failure is preferred
# over silently dropping rows here).
Sequel.migration do
  up do
    alter_table(:plugins) do
      add_index %i[name version], unique: true, name: :plugins_name_version_uidx
    end
  end

  down do
    alter_table(:plugins) do
      drop_index %i[name version], name: :plugins_name_version_uidx
    end
  end
end
