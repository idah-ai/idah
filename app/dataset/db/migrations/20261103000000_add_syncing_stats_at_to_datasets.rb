# frozen_string_literal: true

# Heartbeat for the entry-stats sweep. `syncing_stats` only counts while this
# is recent, so a sweep that died (or whose event was lost) stops showing as
# syncing instead of sticking forever.
Sequel.migration do
  up do
    alter_table(:datasets) do
      add_column :syncing_stats_at, DateTime, null: true
    end

    # Datasets syncing right now get a fresh heartbeat; a sweep that is really
    # running refreshes it, a stuck flag goes stale and clears on its own.
    from(:datasets).where(syncing_stats: true).update(syncing_stats_at: Time.now)
  end

  down do
    alter_table(:datasets) do
      drop_column :syncing_stats_at
    end
  end
end
