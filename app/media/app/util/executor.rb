# frozen_string_literal: true

require "open3"
require "monitor"
require "shellwords"

# Run processes using popen3
class Executor
  include MonitorMixin

  class << self
    def instance
      @instance ||= new
    end
  end

  # A simple executor that runs commands in a separate process using Open3.
  def initialize(max_instances = 4)
    @processes = SizedQueue.new(max_instances)
    @end_signal = new_cond
    Thread.new(&method(:run)) # Start the executor thread
  end

  def escape(command, **opts)
    command % opts.transform_values do |value|
      Shellwords.escape(value.to_s)
    end
  end

  def call(command, **opts, &block)
    cond = new_cond
    @processes << [escape(command, **opts), block, cond]
    synchronize{ cond.wait }
  end

  def stop
    synchronize do
      return unless @running

      @processes << [nil, nil] # Signal to stop the executor
      @end_signal.wait # Wait for the executor to finish processing
    end
  end

  def run
    synchronize{ @running = true }
    loop do
      command, block, cond = @processes.pop

      break if command.nil? && block.nil? # Exit condition for the loop

      Open3.popen3(command) do |stdin, stdout, stderr, wait_thr|
        block.call(stdin, stdout, stderr)

        wait_thr.value
      rescue StandardError => e
        block.call(nil, e.message)
      ensure
        synchronize{ cond.signal } if cond
      end
    rescue ThreadError
      break # Exit loop if the queue is empty and no more commands are available.
    end

    # Notify that the executor has finished processing all commands
    synchronize{ @end_signal.signal; @running = false }
  end
end
