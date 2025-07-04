# frozen_string_literal: true

require "open3"
require "monitor"
require "shellwords"

# Run processes using popen3
class Executor
  class ExecutionError < StandardError; end
  include MonitorMixin

  class << self
    def instance
      @instance ||= new
    end
  end

  class Promise
    include MonitorMixin

    def initialize
      @result = nil
      @status = :running
      @cond = new_cond
    end

    def value
      synchronize do
        case @status
        when :done
          return @result
        when :error
          Kernel.raise @result
        when :running
          @cond.wait
          self.value
        end
      end
    end

    def resolve(value)
      synchronize do
        @result = value
        @status = :done
        @cond.signal
      end
    end

    def raise(value)
      synchronize do
        @result = value
        @status = :error
        @cond.signal
      end
    end
  end

  # A simple executor that runs commands in a separate process using Open3.
  def initialize(max_instances = 4)
    @processes = SizedQueue.new(max_instances)
    @end_signal = new_cond
    @run_thread = Thread.new(&method(:run)) # Start the executor thread
  end

  def escape(command, **opts)
    command % opts.transform_values do |value|
      Shellwords.escape(value.to_s)
    end
  end

  def call(command, **opts, &block)
    call_async(command, **opts, &block).value
  end

  def call_async(command, **opts, &block)
    promise = Promise.new

    command_opts = opts.slice(*command.scan(/%\{(\w+)\}/).flatten.map(&:to_sym))
    popen_opts = opts.except(*command_opts.keys)

    escaped_command = escape(command, **command_opts)

    @processes << [escaped_command, popen_opts, block, promise]
    promise
  end

  def stop
    synchronize do
      return unless @running

      @processes << nil # Signal to stop the executor
      @end_signal.wait # Wait for the executor to finish processing
    end
  end

  def run
    synchronize{ @running = true }
    loop do
      command, opts, block, promise = @processes.pop

      break if promise.nil? # Exit condition for the loop

      Open3.popen3(command, opts) do |stdin, stdout, stderr, wait_thr|
        block.call(stdin, stdout, stderr, wait_thr) if block

        value = wait_thr.value
        if value.success?
          promise.resolve(value)
        else
          e = ExecutionError.new(stderr.read)
          promise.raise(ExecutionError.new(stderr.read))
        end
      rescue StandardError => e
        promise.raise(e)
      end
    rescue ThreadError
      break # Exit loop if the queue is empty and no more commands are available.
    end

    # Notify that the executor has finished processing all commands
    synchronize{ @end_signal.signal; @running = false }
  end
end
