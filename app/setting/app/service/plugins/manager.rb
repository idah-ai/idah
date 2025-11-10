# frozen_string_literal: true

module Plugins
  module Manager
    @queue = Queue.new

    def start
      Thread.new { run }
    end

    def stop
      @queue << nil
    end

    def run
      while command = @queue.pop
        command.call
      end
    end

    def enqueue(&block)
      @queue << block
    end
  end
end
