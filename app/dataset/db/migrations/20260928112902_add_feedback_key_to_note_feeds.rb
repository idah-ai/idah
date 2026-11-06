# frozen_string_literal: true

# Add feedback_keys array column to note_feeds for selecting one or more feedback items.
# Allow content_md to be null since feedback_keys can substitute it.
Sequel.migration do
  up do
    alter_table(:note_feeds) do
      add_column :feedback_keys, "text[]", null: true
      set_column_allow_null :content_md
    end
    add_index :note_feeds, :feedback_keys, type: :gin, name: :idx_note_feeds_feedback_key_gin
  end

  down do
    drop_index :note_feeds, :feedback_keys, name: :idx_note_feeds_feedback_key_gin

    # Feedback-only notes (content_md IS NULL) cannot satisfy the restored
    # NOT NULL constraint and are dropped; notes with real content survive.
    from(:note_feeds).where(content_md: nil).delete

    alter_table(:note_feeds) do
      set_column_not_null :content_md
      drop_column :feedback_keys
    end
  end
end
