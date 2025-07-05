# frozen_string_literal: true

require "spec_helper"

RSpec.describe Executor do
  let!(:executor) { described_class.new(1) }

  after do
    executor.stop
  end

  describe "#escape" do
    it "escapes the command with the given options" do
      command = "echo %<message>s"
      options = { message: "hello world" }
      escaped_command = executor.escape(command, **options)
      expect(escaped_command).to eq("echo hello\\ world")
    end
  end

  describe "#call" do
    context "with a successful command" do
      it "executes the command and yields stdin, stdout, and stderr" do
        output = nil
        executor.call("echo 'hello'") do |_, stdout|
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

    context "with chdir option" do
      it "executes the command in the specified directory" do
        Dir.mktmpdir do |dir|
          output = nil
          executor.call("pwd", chdir: dir) do |_, stdout, _, _|
            output = stdout.read.strip
          end
          expect(output).to eq(dir)
        end
      end
    end
  end

  describe "#stop" do
    it "stops the executor" do
      pool = executor.instance_variable_get(:@pool)
      pool.instance_variable_get(:@workers).each do |worker|
        expect(worker.alive?).to be true
      end

      executor.stop

      pool.instance_variable_get(:@workers).each do |worker|
        expect(worker.alive?).to be false
      end
    end
  end
end
