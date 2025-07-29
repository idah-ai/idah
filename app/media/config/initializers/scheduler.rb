# frozen_string_literal: true

# Setup jobs scheduler and executor for media processing.
SCHEDULER = Jobs::Scheduler.new
# Setup executor for ffmpeg jobs.
EXECUTOR = Executor.new(4)

Verse.on_stop do
  SCHEDULER.stop
  EXECUTOR.stop
end

puts ENV["PUMA_WORKERS"]

if ENV["PUMA_WORKERS"] &&
   ENV["PUMA_WORKERS"] == "1"

   # If running in a single worker mode,
   # start the scheduler immediately.
   # Otherwise, puma on_worker_boot will handle it.
   Verse.on_boot do
    SCHEDULER.start
    EXECUTOR.start
   end
end
