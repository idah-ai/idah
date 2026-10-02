# frozen_string_literal: true

# Registered plugins.
Sequel.migration do
  change do
    create_table(:plugins) do
      column :id, :bigserial, primary_key: true

      column :source_type, String, null: false, index: true
      column :source_path, String, null: false
      column :name, String, null: false, index: true
      column :description, String, null: false
      column :status, String, null: false, index: true, default: "pending"

      column :version, String, null: false

      Migration::Timestamps.timestamps(self)
    end
    Migration::Timestamps.trg_updated_at(self, :plugins)

    # create_table(:plugin_images) do
    #   column :id, String, primary_key: true

    #   reference :plugin_id, :plugins, null: false, on_delete: :restrict
    #   column :service, String, null: false

    #   column :size, Integer, null: false

    #   index %i[plugin_id service], unique: true

    #   Migration::Timestamps.timestamps(self)
    # end
  end
end
