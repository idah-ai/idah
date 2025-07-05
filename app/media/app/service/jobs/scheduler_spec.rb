# frozen_string_literal: true

require "spec_helper"
require_relative "../../../app/service/jobs/scheduler"

module Spec
  class CustomJob < Jobs::Base
    class << self
      attr_accessor :ran
    end

    def initialize(job_id, arguments)
      super
      self.class.ran = false
    end

    def run
      self.class.ran = true
    end
  end
end

RSpec.describe Jobs::Scheduler do
  let(:job_repository) {
    double("JobRepository")
  }

  let(:job1) {
    double(
      "job",
      id: 1,
      job_class: "Spec::CustomJob",
      arguments: { "foo" => "bar" },
      priority: 0,
      status: "pending",
      scheduled_at: Time.now,
      retry_count: 0
    )
  }

  let(:thread_pool) {
    double("ThreadPool")
  }

  subject { described_class.new }

  before do
    Spec::CustomJob.ran = false

    allow(ThreadPool).to receive(:new).and_return(thread_pool)
    allow(thread_pool).to receive(:free).and_return(1)
    allow(thread_pool).to receive(:stop)

    # Stub the repository
    allow(subject).to receive(:jobs).and_return(job_repository)
  end

  after do
    subject.stop
  end

  describe "running scheduler" do
    it "checks for available jobs" do
      expect(job_repository).to receive(:lock_available).with(1).at_least(:once).and_return([])
      allow(job_repository).to receive(:next_scheduled_time).and_return(nil)

      subject.start
      sleep 0.05 # allow the thread to run
    end

    context "when a job is available" do
      it "processes the job" do
        expect(job_repository).to receive(:lock_available).and_return([job1])
        allow(job_repository).to receive(:next_scheduled_time).and_return(nil)
        allow(job_repository).to receive(:update_progress).with(1, 1.0).and_return(true)

        allow(thread_pool).to receive(:run) do |&block|
          block.call
        end

        subject.start
        sleep 0.01 # allow the thread to run

        expect(Spec::CustomJob.ran).to be true
      end
    end

    context "when a job is scheduled" do
      let(:scheduled_time) { Time.now + 0.1 }

      before do
        allow(job_repository).to receive(:next_scheduled_time).and_return(scheduled_time)
      end

      it "waits for the scheduled time" do
        wait_cond = subject.instance_variable_get(:@wait_cond)
        allow(job_repository).to receive(:lock_available).and_return([])
        # The time might not be exact, so we check that it's called with a value
        # close to the expected one.
        expect(wait_cond).to receive(:wait).with(be_within(0.1).of(0.1)).and_call_original
        subject.start
        sleep 0.11 # allow the thread to run and wait
      end

      it "runs continuously" do
        allow(job_repository).to receive(:lock_available).and_return([])
        allow(job_repository).to receive(:next_scheduled_time).and_return(nil)

        subject.start
        sleep 0.1
        scheduler_thread = subject.instance_variable_get(:@scheduler)
        expect(scheduler_thread).to be_alive
      end
    end
  end

  describe "#signal" do
    it "signals the wait condition" do
      wait_cond = subject.instance_variable_get(:@wait_cond)
      expect(wait_cond).to receive(:signal).once
      subject.signal
      # prevent the after block from running `stop` which would call signal again
      allow(subject).to receive(:stop)
    end
  end
end
