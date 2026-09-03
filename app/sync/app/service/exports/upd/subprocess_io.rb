# frozen_string_literal: true

module Exports
  module Upd
    # Helper to manage bidirectional communication with updcli-static subprocess.
    # Handles non-blocking I/O with automatic retry for large writes (>64KB) and
    # simultaneous output draining to prevent deadlocks.
    class SubprocessIO
      # Timeout (seconds) for IO.select operations
      SELECT_TIMEOUT = 10

      # Raised when updcli-static closes stdin unexpectedly
      class StreamClosed < StandardError; end

      def initialize(stdin, stdout, stderr, on_output: nil)
        @stdin = stdin
        @stdout = stdout
        @stderr = stderr
        @on_output = on_output
        @err_lines = []
      end

      attr_reader :err_lines

      # Write a JSONL command to stdin. Handles large lines (>64KB) that would
      # overflow the pipe buffer by using write_nonblock with IO.select retry.
      # Drains subprocess output simultaneously to prevent deadlock.
      #
      # Raises:
      # - StreamClosed: if the subprocess closes stdin unexpectedly
      def write_jsonl(line)
        data_to_write = line.end_with?("\n") ? line : "#{line}\n"

        while data_to_write.bytesize > 0
          ready_read, ready_write, = IO.select([@stdout, @stderr], [@stdin], nil, SELECT_TIMEOUT)

          if ready_read.nil? && ready_write.nil?
            raise "Timeout while waiting to communicate with updcli-static"
          end

          # 1. Read any available output to prevent deadlock
          #    (subprocess can't write if pipes are full)
          read_available_output(ready_read)

          # 2. Try to write to stdin if it's ready
          next unless ready_write&.include?(@stdin)

          perform_nonblock_write(data_to_write) do |written|
            data_to_write = data_to_write.byteslice(written..-1)
          end
        end
      end

      # Non-blocking read of whatever output the subprocess has produced so
      # far. Returns an array of [chunk, stream] pairs, with :out or :err.
      # Chunks are NOT emitted via emit_output here — they will be picked
      # up by the next write_jsonl's read_available_output or the final
      # read_remaining_output.
      #
      # If filter is given, only lines containing that string are returned
      # (non-matching lines are still consumed from the pipe and discarded).
      def read_output_now(filter: nil, timeout: 0.1)
        lines = []

        loop do
          ready = IO.select([@stdout, @stderr], nil, nil, timeout)
          break unless ready

          ready.first.each do |io|
            stream = (io == @stdout) ? :out : :err

            loop do
              chunk = io.read_nonblock(4096, exception: false)
              case chunk
              when :wait_readable
                break
              when nil # EOF
                break
              else
                lines << [chunk, stream] if filter.nil? || chunk.include?(filter)
              end
            end
          end
        end

        lines
      end

      # Read all remaining output from both streams until EOF or timeout.
      # Prevents hangs if the subprocess stalls on full output pipes.
      def read_remaining_output
        streams = { @stdout => :out, @stderr => :err }

        until streams.empty?
          ready = IO.select(streams.keys, nil, nil, SELECT_TIMEOUT)
          unless ready
            Verse.logger&.warn do
              "updcli: drain timeout (#{SELECT_TIMEOUT}s) — skipping remaining output"
            end
            break
          end

          ready.first.each do |io|
            loop do
              chunk = io.read_nonblock(4096, exception: false)

              case chunk
              when :wait_readable
                break
              when nil # EOF
                streams.delete(io)
                break
              else
                emit_output(chunk, streams[io])
              end
            rescue IOError, Errno::EPIPE, Errno::ECONNRESET
              streams.delete(io)
              break
            end
          end
        end
      end

      private

      # Read any available output from the streams that are ready; non-blocking.
      def read_available_output(ready_read)
        ready_read&.each do |io|
          loop do
            chunk = io.read_nonblock(4096, exception: false)
            case chunk
            when :wait_readable
              break
            when nil
              raise StreamClosed, "updcli-static closed its outputs prematurely"
            else
              type = io == @stdout ? :out : :err
              emit_output(chunk, type)
            end
          end
        end
      end

      # Attempt a non-blocking write; retry on EAGAIN, raise on EPIPE
      def perform_nonblock_write(data)
        written = @stdin.write_nonblock(data)
        yield written
      rescue IO::WaitWritable
        # Pipe filled up mid-write; loop will retry after IO.select tells us
        # it's writable (next iteration will call IO.select and come back
        # here when ready)
      rescue Errno::EPIPE, IOError => e
        raise StreamClosed, "updcli-static closed its stdin: #{e.message}"
      end

      # Emit output: collect stderr, log or callback
      def emit_output(chunk, stream)
        @err_lines << chunk if stream == :err

        if @on_output
          @on_output.call(chunk, stream)
        elsif stream == :out
          Verse.logger&.debug { "updcli: #{chunk}" }
        else
          Verse.logger&.warn { "updcli: #{chunk}" }
        end
      end
    end
  end
end
