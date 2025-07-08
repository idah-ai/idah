# frozen_string_literal: true

# Create a default scheduler instance.
# This will attach to Jobs::Scheduler.instance
SCHEDULER = Jobs::Scheduler.new

Verse.on_boot do
  SCHEDULER.start if Verse.mode == :server
end
