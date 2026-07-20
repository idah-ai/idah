# frozen_string_literal: true

require "open3"
require "monitor"
require "shellwords"

# Run processes using popen3
class Executor
  class ExecutionError < StandardError; end
  class TimeoutError < ExecutionError; end

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
          value
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

  attr_reader :instances

  # A simple executor that runs commands in a separate process using Open3.
  def initialize(max_instances = 4)
    @instances = max_instances
    start
  end

  def escape(command, **opts)
    command % opts.transform_values do |value|
      Shellwords.escape(value.to_s)
    end
  end

  def call(command, timeout: nil, **opts, &block)
    call_async(command, timeout: timeout, **opts, &block).value
  end

  def call_async(command, timeout: nil, **opts, &block)
    promise = Promise.new

    command_vars = \
      command
      .scan(/%[{<](\w+)[}>]/)
      .flatten
      .map(&:to_sym)
      .uniq

    popen_opts = opts.except(
      *command_vars
    )

    escaped_command = escape(command, **opts)

    @pool.run do
      Open3.popen3(escaped_command, popen_opts) do |stdin, stdout, stderr, wait_thr|
        block&.call(stdin, stdout, stderr, wait_thr)

        if timeout
          deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + timeout

          loop do
            remaining = deadline - Process.clock_gettime(Process::CLOCK_MONOTONIC)

            if remaining <= 0
              Process.kill("TERM", wait_thr.pid)

              unless wait_thr.join(2)
                begin
                  Process.kill("KILL", wait_thr.pid)
                rescue StandardError
                  nil
                end
              end

              wait_thr.value

              promise.raise(
                TimeoutError.new(
                  "Command timed out after #{timeout}s:\n#{stderr.read}"
                )
              )
              break
            end

            # Wait for the thread with a short poll interval
            result = wait_thr.join([remaining, 0.1].min)
            next unless result

            # Thread finished — process exited
            value = wait_thr.value
            if value.success?
              promise.resolve(value)
            else
              promise.raise(
                ExecutionError.new(stderr.read)
              )
            end
            break
          end
        else
          value = wait_thr.value

          if value.success?
            promise.resolve(value)
          else
            promise.raise(
              ExecutionError.new(stderr.read)
            )
          end
        end
      end
    rescue StandardError => e
      promise.raise(e)
    end

    promise
  end

  def start
    stop if @pool
    @pool = ThreadPool.new(size: @instances)
  end

  def stop
    return unless @pool

    @pool.stop
  end
end
