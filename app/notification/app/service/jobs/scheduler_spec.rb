# frozen_string_literal: true

require "spec_helper"

RSpec.describe Jobs::Scheduler, database: true do
  let(:jobs) { Jobs::Repository.new(Verse::Auth::Context[:system]) }

  before do
    stub_const(
      "SchedulerSpecFailingJob",
      Class.new(Jobs::Base) do
        self.max_retries = 2
        def run_impl = error("HTTP 500")
      end
    )
  end

  def create_job(retry_count: 0, status: "running", updated_at: Time.now)
    jobs.create(
      {
        job_class: "SchedulerSpecFailingJob",
        arguments: {},
        status:,
        retry_count:,
        scheduled_at: Time.now,
        updated_at:
      }
    )
  end

  subject(:scheduler) { described_class.new }

  it "reschedules a failed job with backoff while retries remain" do
    id = create_job(retry_count: 0)

    scheduler.execute(jobs.find!(id))

    job = jobs.find!(id)
    expect(job.status).to eq "pending"
    expect(job.retry_count).to eq 1
    expect(job.error).to eq "HTTP 500"
    expect(job.scheduled_at).to be > Time.now
  end

  it "marks the job errored, with the message as text, once retries are used up" do
    id = create_job(retry_count: 2)

    scheduler.execute(jobs.find!(id))

    job = jobs.find!(id)
    expect(job.status).to eq "errored"
    expect(job.error).to eq "HTTP 500"
  end
end
