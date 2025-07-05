# The process executor is used to run commands in a separate process, allowing for asynchronous execution and better resource management.
# It uses a thread pool to manage multiple processes efficiently.
EXECUTOR = Executor.new(4)

Verse.on_boot do
  EXECUTOR.start
end

Verse.on_stop do
  EXECUTOR.stop
end