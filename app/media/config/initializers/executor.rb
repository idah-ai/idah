# frozen_string_literal: true

# Setup executor for ffmpeg jobs.
EXECUTOR = Executor.new(4)

Verse.on_stop do
  EXECUTOR.stop
end
