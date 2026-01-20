# frozen_string_literal: true

Sequel.migration do
  change do
    alter_table(:accounts) do
      add_column :invitation_token, String, null: true, index: true
    end
  end
end
