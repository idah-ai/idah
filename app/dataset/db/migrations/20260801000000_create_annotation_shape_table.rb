# frozen_string_literal: true

Sequel.migration do
  change do
    create_table(:annotation_shape) do
      foreign_key :annotation_id,
                  :annotations,
                  type: :uuid,
                  null: false,
                  on_delete: :cascade,
                  on_update: :cascade

      column :key, :text, null: false
      column :value, :jsonb, null: false

      primary_key %i[annotation_id key]
    end
  end
end
