# frozen_string_literal: true

require "spec_helper"
require_relative "../../../app/service/jobs/thread_pool"

RSpec.describe Jobs::ThreadPool do
  subject { described_class.new(size: 2) }

  after do
    subject.stop
  end

  describe "#run" do
    it "executes a given block" do
      executed = false
      subject.run do
        executed = true
      end
      sleep 0.01 # allow the thread to run
      expect(executed).to be true
    end

    it "executes multiple blocks" do
      counter = 0
      mutex = Mutex.new
      5.times do
        subject.run do
          mutex.synchronize { counter += 1 }
        end
      end
      sleep 0.05 # allow threads to run
      expect(counter).to eq(5)
    end
  end

  describe "#free" do
    it "returns the number of free workers" do
      expect(subject.free).to eq(2)
      subject.run { sleep 0.1 }
      sleep 0.01 # allow the thread to pick up the job
      expect(subject.free).to eq(1)
      sleep 0.1 # allow the job to finish
      expect(subject.free).to eq(2)
    end
  end

  describe "#usage" do
    it "returns the number of busy workers" do
      expect(subject.usage).to eq(0)
      subject.run { sleep 0.1 }
      sleep 0.01 # allow the thread to pick up the job
      expect(subject.usage).to eq(1)
      sleep 0.1 # allow the job to finish
      expect(subject.usage).to eq(0)
    end
  end

  describe "#stop" do
    it "stops all worker threads" do
      subject.run { sleep 0.1 }
      subject.run { sleep 0.1 }
      subject.stop
      workers = subject.instance_variable_get(:@workers)
      expect(workers.all? { |t| !t.alive? }).to be true
    end
  end
end
