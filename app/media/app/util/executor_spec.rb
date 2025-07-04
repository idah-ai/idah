# frozen_string_literal: true

require "spec_helper"

RSpec.describe Executor do
  let(:executor) { described_class.new(1) }

  after do
    executor.stop
  end

  describe "#escape" do
    it "escapes the command with the given options" do
      command = "echo %{message}"
      options = { message: "hello world" }
      escaped_command = executor.escape(command, **options)
      expect(escaped_command).to eq("echo hello\\ world")
    end
  end

  describe "#call" do
    context "with a successful command" do
      it "executes the command and yields stdin, stdout, and stderr" do
        output = nil
        executor.call("echo 'hello'") do |_, stdout, _|
          output = stdout.read
        end
        expect(output).to eq("hello\n")
      end
    end

    context "with a failing command" do
      it "raises an ExecutionError" do
        expect {
          executor.call("false")
        }.to raise_error(Executor::ExecutionError)
      end
    end
  end

  describe "#stop" do
    it "stops the executor" do
      # This is tricky to test directly, but we can check if the thread is alive.
      # The executor starts a thread on initialization.
      # After stopping, the thread should not be alive.
      # We need to give it a moment to stop.
      thread = executor.instance_variable_get(:@run_thread)
      expect(thread).to be_alive

      executor.stop
      sleep 0.1 # Give it a moment to stop

      expect(thread).not_to be_alive
    end
  end
end
