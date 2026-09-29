# frozen_string_literal: true

# Add feedback_key column to note_feeds for selecting a feedback item.
# Allow content_md to be null since feedback_key can substitute it.
Sequel.migration do
  change do
    alter_table(:note_feeds) do
      add_column :feedback_key, String, null: true
      set_column_allow_null :content_md
      add_index [:dataset_id, :feedback_key], name: :idx_note_feeds_dataset_feedback_key
    end
  end
end