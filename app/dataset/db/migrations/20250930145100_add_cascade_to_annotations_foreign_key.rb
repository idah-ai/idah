# frozen_string_literal: true

Sequel.migration do
  change do
    execute <<-SQL
      -- Drop the existing foreign key constraint (keeping the column)
      ALTER TABLE annotations DROP CONSTRAINT annotations_entry_id_fkey;

      -- Recreate with the complete definition including cascade options
      ALTER TABLE annotations ADD CONSTRAINT annotations_entry_id_fkey
        FOREIGN KEY (entry_id) REFERENCES entries(id)
        ON DELETE CASCADE ON UPDATE CASCADE;
    SQL
  end
end
