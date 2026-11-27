# frozen_string_literal: true

module TimeTracking
  SLOT = 120 # 2 minutes in seconds

  # Compute the slot start for a given Time (even-minute floor, 2-min grid)
  def self.slot_for(time)
    t = time.to_i
    Time.at((t / SLOT) * SLOT).utc
  end

  # Whether a workflow step is eligible for time tracking.
  # Currently a constant allowlist; later can read from plugin definitions.
  def self.step_allowed?(wf_step)
    %w[annotate review].include?(wf_step)
  end

  # Called on every user action (mutation hook or /activity ping).
  # Guarded: must be called inside a savepoint.
  def self.touch(
    entry_repo:,
    slot_repo:,
    work_repo:,
    entry_id:,
    account_id:,
    email:,
    at: Time.now
  )
    # Skip when there is no account (system/service contexts)
    return if account_id.nil?

    # FOR SHARE
    # blocks concurrent writes, closing the race that would otherwise re-open
    # a session on the rolled-up step.
    locked = entry_repo.table.where(id: entry_id).for_share.first
    return unless locked

    return unless locked[:assigned_to_id] == account_id
    return unless step_allowed?(locked[:wf_step])

    step = locked[:wf_step]
    slot_start = slot_for(at)

    return unless slot_repo.insert_slot(entry_id, account_id, step, slot_start)

    work_repo.upsert_open_row(entry_id, account_id, step, at, email)
  end

  # Touch wrapped in a forced savepoint so a tracking failure can never abort
  # the surrounding transaction (annotation, note, etc.).
  def self.safe_touch(entry_repo:, **kwargs)
    entry_repo.client do |db|
      db.transaction(savepoint: true, auto_savepoint: true) do
        touch(entry_repo: entry_repo, **kwargs)
      end
    end
  rescue StandardError => e
    Verse.logger&.error { "TimeTracking.touch failed: #{e.class}: #{e.message}" }
  end

  # Called on submit / error. Finalizes every open session on the leaving step.
  def self.rollup(
    slot_repo:,
    work_repo:,
    system_entries_repo:,
    entry_id:,
    wf_step:,
    submitted_at: Time.now
  )
    rows = work_repo.open_sessions_for(entry_id, wf_step)

    rows.each do |row|
      min_slot_start = slot_for(row[:session_started_at])

      slots = slot_repo.table
                       .where(entry_id:, account_id: row[:account_id], wf_step:)
                       .where { slot_start >= min_slot_start }
                       .order(:slot_start)
                       .all

      next if slots.empty?

      first_slot = slots.first
      last_slot = slots.last
      ended_at = [submitted_at, last_slot[:slot_start] + SLOT].min

      delta = if slots.size == 1
                [SLOT, ended_at - row[:session_started_at]].min
              else
                first = [SLOT, (first_slot[:slot_start] + SLOT) - row[:session_started_at]].min
                middle = SLOT * (slots.size - 2)
                last = [SLOT, ended_at - last_slot[:slot_start]].min
                first + middle + last
              end

      work_repo.finalize_session(row[:id], delta)

      # Purge the slots that were rolled up into this finalized session
      slot_repo.table
               .where(entry_id:, account_id: row[:account_id], wf_step:)
               .where { slot_start >= min_slot_start }
               .delete
    end

    # Refresh the combined per-step cache
    recompute_entry_cache(system_entries_repo, entry_id)
  end

  # Recompute entries.time_tracking from all entry_work_times rows of the entry.
  def self.recompute_entry_cache(system_entries_repo, entry_id)
    rows = system_entries_repo.table.db[:entry_work_times]
                              .where(entry_id:)
                              .all

    cache = rows.group_by { |r| r[:wf_step] }
                .transform_values { |rs| rs.sum { |r| r[:seconds] } }

    system_entries_repo.update_time_tracking(entry_id, cache.empty? ? nil : cache)
  end
end
