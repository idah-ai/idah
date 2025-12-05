# frozen_string_literal: true

# Setup jobs scheduler for sync processing.
SCHEDULER = Jobs::Scheduler.new

Verse.on_stop do
  SCHEDULER.stop
end

puts ENV["PUMA_WORKERS"]

if ENV["PUMA_WORKERS"] &&
   ENV["PUMA_WORKERS"] == "1"

  # If running in a single worker mode,
  # start the scheduler immediately.
  # Otherwise, puma on_worker_boot will handle it.
  Verse.on_boot do
    puts "starting schehuler ?"
    SCHEDULER.start
  end
end
