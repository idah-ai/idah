# frozen_string_literal: true

module Migration
  module Timestamps
    extend self

    def install_updated_at_function
      Sequel::Model.db.run <<-SQL
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          IF current_query() !~ '[^a-zA-Z0-9_]updated_at[^a-zA-Z0-9_]' THEN
            NEW.updated_at = NOW();
          END IF;

          RETURN NEW;
        END;
        $$ language 'plpgsql';
      SQL
    end

    def trg_updated_at(db, table, trigger_name: nil)
      trigger_name ||= :"#{table}_updated_at"

      db.create_trigger(
        table,
        trigger_name,
        :update_updated_at_column,
        events: :update,
        each_row: true,
      )
      trigger_name
    end

    def timestamps(table, updated_at: true, index: true)
      table.column(
        :created_at,
        DateTime,
        null: false,
        default: Sequel.lit("NOW()"),
        index:
      )

      return unless updated_at

      table.column :updated_at, DateTime, null: false, default: Sequel.lit("NOW()")
    end
  end
end
