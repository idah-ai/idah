# frozen_string_literal: true

require "open3"
require "monitor"
require "shellwords"

# Run processes using popen3
class Executor
  class ExecutionError < StandardError; end

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

  def call(command, **opts, &block)
    call_async(command, **opts, &block).value
  end

  def call_async(command, **opts, &block)
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

        value = wait_thr.value

        if value.success?
          promise.resolve(value)
        else
          promise.raise(
            ExecutionError.new(stderr.read)
          )
        end
      rescue StandardError => e
        promise.raise(e)
      end
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
