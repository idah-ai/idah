# frozen_string_literal: true

Sequel.migration do
  up do
    create_table(:entry_time_slots) do
      column :id, :uuid, primary_key: true, default: Sequel.lit("uuid_generate_v7()")
      foreign_key :entry_id, :entries, type: :uuid, null: false, on_delete: :cascade
      column :account_id, Integer, null: false
      column :wf_step, String, null: false
      column :slot_start, DateTime, null: false

      unique %i[entry_id account_id wf_step slot_start]
    end

    create_table(:entry_work_times) do
      column :id, :uuid, primary_key: true, default: Sequel.lit("uuid_generate_v7()")
      foreign_key :entry_id, :entries, type: :uuid, null: false, on_delete: :cascade
      column :account_id, Integer, null: false
      column :wf_step, String, null: false
      column :seconds, Integer, null: false, default: 0
      column :session_started_at, DateTime, null: true
      column :email, String, null: true

      Migration::Timestamps.timestamps(self)

      index %i[account_id wf_step]
    end
    Migration::Timestamps.trg_updated_at(self, :entry_work_times)

    # Partial unique index: at most one open row per (entry, account, step)
    run <<-SQL
      CREATE UNIQUE INDEX idx_entry_work_times_open_session
      ON entry_work_times (entry_id, account_id, wf_step)
      WHERE session_started_at IS NOT NULL;
    SQL

    alter_table(:entries) do
      add_column :time_tracking, :jsonb
    end
  end

  down do
    alter_table(:entries) do
      drop_column :time_tracking
    end
    drop_table(:entry_work_times)
    drop_table(:entry_time_slots)
  end
end