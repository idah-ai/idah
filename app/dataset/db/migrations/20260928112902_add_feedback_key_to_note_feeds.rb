# frozen_string_literal: true

# Add feedback_keys array column to note_feeds for selecting one or more feedback items.
# Allow content_md to be null since feedback_keys can substitute it.
Sequel.migration do
  change do
    alter_table(:note_feeds) do
      add_column :feedback_keys, "text[]", null: true
      set_column_allow_null :content_md
    end
    add_index :note_feeds, :feedback_keys, type: :gin, name: :idx_note_feeds_feedback_key_gin
  end
end
