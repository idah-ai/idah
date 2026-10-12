# frozen_string_literal: true

require "spec_helper"

RSpec.describe Jobs::Repository, database: true do
  subject(:jobs) { described_class.new(Verse::Auth::Context[:system]) }

  def create_job(status:, updated_at: Time.now)
    jobs.create(
      { job_class: "Webhook::DeliveryJob", arguments: {}, status:, scheduled_at: Time.now, updated_at: }
    )
  end

  describe "#reclaim_stale" do
    it "puts jobs stuck in running back to pending" do
      stale = create_job(status: "running", updated_at: Time.now - 3600)
      fresh = create_job(status: "running")

      jobs.reclaim_stale

      expect(jobs.find!(stale).status).to eq "pending"
      expect(jobs.find!(fresh).status).to eq "running"
    end
  end

  describe "#cleanup" do
    it "deletes finished jobs older than 30 days and keeps the rest" do
      old_completed = create_job(status: "completed", updated_at: Time.now - (31 * 86_400))
      old_errored = create_job(status: "errored", updated_at: Time.now - (31 * 86_400))
      old_pending = create_job(status: "pending", updated_at: Time.now - (31 * 86_400))
      recent = create_job(status: "completed", updated_at: Time.now - (29 * 86_400))

      jobs.cleanup

      remaining = jobs.index({}).map(&:id)
      expect(remaining).to contain_exactly(old_pending, recent)
      expect(remaining).not_to include(old_completed, old_errored)
    end
  end
end
