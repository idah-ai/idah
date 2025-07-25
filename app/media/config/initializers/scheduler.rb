# frozen_string_literal: true

SCHEDULER = Jobs::Scheduler.new

Verse.on_stop{ SCHEDULER.stop }
