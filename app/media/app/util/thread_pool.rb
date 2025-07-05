# frozen_string_literal: true

class ThreadPool
  include MonitorMixin

  attr_reader :size, :usage

  def initialize(size: 4)
    @size = size
    @workers = Array.new(size) { Thread.new(&method(:worker_loop)) }
    @queue = Queue.new

    @usage = 0

    @condition = new_cond
  end

  def free = @size - @usage

  def run(&block)
    @queue << block
  end

  def stop
    @queue.close
    @workers.each(&:join)
  end

  protected

  def worker_loop
    Thread.current.name = "Jobs::ThreadPool Worker (#{Thread.current.object_id})"

    loop do
      break if @queue.closed?

      task = @queue.pop

      next if task.nil?

      begin
        synchronize{ @usage += 1 }
        task.call
      rescue StandardError => e
        Verse.logger&.error{ "Error in worker thread: [#{e.class.name}] #{e.message}" }
        Verse.logger&.error{ e.backtrace.join("\n") }
      ensure
        synchronize{ @usage -= 1 }
      end
    rescue ThreadError, ClosedQueueError
      # Exit if the queue is empty and no more tasks are available.
      break if @queue.closed? || @queue.empty?
    end
  end
end
