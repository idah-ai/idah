# frozen_string_literal: true

# Create a default scheduler instance.
# This will attach to Jobs::Scheduler.instance
SCHEDULER = Jobs::Scheduler.new

Verse.on_stop{ SCHEDULER.stop }
