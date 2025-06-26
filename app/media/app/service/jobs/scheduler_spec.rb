# frozen_string_literal: true

require "spec_helper"
require_relative "../../../app/service/jobs/scheduler"

RSpec.describe Jobs::Scheduler do
  let(:job_repository) { double("JobRepository") }
  let(:thread_pool) { double("Jobs::ThreadPool") }

  before do
    allow(Jobs::ThreadPool).to receive(:new).and_return(thread_pool)
    allow(thread_pool).to receive(:free).and_return(1)
    allow(thread_pool).to receive(:stop)

    allow(job_repository).to receive(:lock_available).and_return(nil)
    allow(job_repository).to receive(:next_scheduled_time).and_return(nil)

    # Stub the repository
    allow_any_instance_of(described_class).to receive(:jobs).and_return(job_repository)
  end

  subject { described_class.new }

  after do
    subject.stop
    # wait for the thread to stop
    subject.instance_variable_get(:@scheduler).join
  end

  describe "running scheduler" do
    it "checks for available jobs" do
      expect(job_repository).to receive(:lock_available).with(1).at_least(:once)
      subject
      sleep 0.01 # allow the thread to run
    end

    context "when a job is available" do
      let(:job) { double("Job") }

      before do
        # To avoid infinite loop
        allow(job_repository).to receive(:lock_available).and_return(job, nil)
      end

      it "processes the job" do
        expect(Jobs::Executor).to receive(:new).with(job, anything).and_return(double(run: true))
        subject
        sleep 0.01 # allow the thread to run
      end
    end

    context "when a job is scheduled" do
      let(:scheduled_time) { Time.now + 0.02 }

      before do
        allow(job_repository).to receive(:next_scheduled_time).and_return(scheduled_time)
      end

      it "waits for the scheduled time" do
        wait_cond = subject.instance_variable_get(:@wait_cond)
        expect(wait_cond).to receive(:wait).with(be_within(0.01).of(0.02)).and_call_original
        subject
        sleep 0.03 # allow the thread to run and wait
      end
    end
  end

  describe "#stop" do
    it "stops the scheduler" do
      scheduler_thread = subject.instance_variable_get(:@scheduler)
      allow(scheduler_thread).to receive(:join)

      expect(thread_pool).to receive(:stop)
      subject.stop
    end
  end

  describe "#signal" do
    it "signals the wait condition" do
      wait_cond = subject.instance_variable_get(:@wait_cond)
      expect(wait_cond).to receive(:signal)
      subject.signal
    end
  end
end
