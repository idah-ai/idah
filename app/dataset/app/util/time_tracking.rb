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

    # Verify the caller is the assignee; use the entry's own current step.
    entry = entry_repo.find!(entry_id)
    return unless entry.assigned_to_id == account_id
    return unless step_allowed?(entry.wf_step)

    step = entry.wf_step
    slot_start = slot_for(at)

    slot_repo.insert_slot(entry_id, account_id, step, slot_start)
    work_repo.upsert_open_row(entry_id, account_id, step, at, email)
  end
  # rubocop:enable Metrics/ParameterLists

  # Touch wrapped in a nested transaction (Sequel turns a nested transaction into
  # a savepoint) so a tracking failure can never abort the surrounding save
  # (annotation, note, etc.). Errors are swallowed.
  def self.safe_touch(entry_repo:, **kwargs)
    entry_repo.transaction do
      touch(entry_repo: entry_repo, **kwargs)
    end
  rescue StandardError => e
    Verse.logger&.error { "TimeTracking.touch failed: #{e.class}: #{e.message}" }
  end

  # Called on submit / error. Finalizes every open session on the leaving step.
  # rubocop:disable Metrics/ParameterLists
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
    end

    # Refresh the combined per-step cache
    recompute_entry_cache(system_entries_repo, entry_id)
  end
  # rubocop:enable Metrics/ParameterLists

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
