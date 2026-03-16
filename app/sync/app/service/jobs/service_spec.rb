# frozen_string_literal: true

RSpec.describe Jobs::Service, database: true do
  let(:service) { described_class.new(Verse::Auth::Context[:system]) }
  let(:repo) { service.repo }

  describe "#create" do
    it "creates a job record" do
      expect(repo).to receive(:transaction).and_yield
      expect(repo).to receive(:create).with(
        hash_including(
          job_class: "MyJob",
          arguments: { "a" => 1 },
          priority: 10,
          status: "pending",
          retry_count: 0,
          progress: 0.0
        )
      ).and_return(1)
      expect(repo).to receive(:find!).with(1)

      service.create(
        "MyJob",
        arguments: { "a" => 1 },
        priority: 10
      )
    end

    it "creates a job with default values" do
      job = service.create("MyJob")

      expect(job.job_class).to eq("MyJob")
      expect(job.arguments).to eq({})
      expect(job.priority).to eq(0)
      expect(job.status).to eq("pending")
      expect(job.retry_count).to eq(0)
      expect(job.progress).to eq(0.0)
    end

    it "creates a job with custom arguments" do
      job = service.create(
        "MyExportJob",
        arguments: { dataset_ids: [1, 2, 3], format: "csv" },
        priority: 5
      )

      expect(job.arguments).to eq({ dataset_ids: [1, 2, 3], format: "csv" })
      expect(job.priority).to eq(5)
    end

    it "sets scheduled_at to provided time" do
      future_time = Time.now + 3600
      job = service.create("MyJob", scheduled_at: future_time)

      expect(job.scheduled_at.to_i).to eq(future_time.to_i)
    end

    it "sets unicity when provided" do
      job = service.create("MyJob", unicity: "unique_key_123")

      expect(job.unicity).to eq("unique_key_123")
    end
  end

  describe "#index" do
    before do
      service.create("Job1", priority: 10)
      service.create("Job2", priority: 5)
      service.create("Job3", priority: 1)
    end

    it "returns all jobs" do
      jobs = service.index.to_a
      expect(jobs.size).to eq(3)
    end

    it "filters jobs by status" do
      job = service.create("Job4", priority: 1)
      repo.update!(job.id, { status: "running" })

      jobs = service.index({ status: "running" }).to_a
      expect(jobs.size).to eq(1)
      expect(jobs.first.status).to eq("running")
    end

    it "supports pagination" do
      jobs = service.index({}, page: 1, items_per_page: 2).to_a
      expect(jobs.size).to eq(2)
    end

    it "supports sorting" do
      jobs = service.index({}, sort: ["priority"]).to_a
      priorities = jobs.map(&:priority)
      expect([1, 5, 10]).to include(priorities.first)
    end

    it "accepts included parameter" do
      jobs = service.index({}, included: []).to_a
      expect(jobs.size).to eq(3)
    end

    it "accepts query_count parameter" do
      result = service.index({}, query_count: true)
      expect(result).to respond_to(:to_a)
    end
  end

  describe "#show" do
    let!(:job_id) do
      job = service.create("MyJob", arguments: { test: true })
      job.id
    end

    it "returns the job by id" do
      job = service.show(job_id)
      expect(job.id).to eq(job_id)
      expect(job.job_class).to eq("MyJob")
      expect(job.arguments).to eq({ test: true })
    end

    it "accepts included parameter" do
      job = service.show(job_id, included: [])
      expect(job.id).to eq(job_id)
    end

    it "raises error when job not found" do
      fake_uuid = UUIDv7.generate
      expect {
        service.show(fake_uuid)
      }.to raise_error(Verse::Error::RecordNotFound)
    end
  end

  describe "#delete" do
    let!(:job_id) do
      job = service.create("MyJob")
      job.id
    end

    it "deletes the job" do
      service.delete(job_id)

      expect {
        repo.find!(job_id)
      }.to raise_error(Verse::Error::RecordNotFound)
    end
  end

  describe "#update" do
    let!(:job) do
      service.create("MyJob", arguments: { initial: true }, priority: 0)
    end

    it "updates the job record" do
      record = deserialize(
        {
          data: {
            type: "sync:jobs",
            id: job.id,
            attributes: {
              status: "running",
              progress: 0.5
            }
          }
        }
      )

      updated_job = service.update(record)

      expect(updated_job.status).to eq("running")
      expect(updated_job.progress).to eq(0.5)
    end

    it "updates job arguments" do
      record = deserialize(
        {
          data: {
            type: "sync:jobs",
            id: job.id,
            attributes: {
              arguments: { updated: true, count: 42 }
            }
          }
        }
      )

      updated_job = service.update(record)

      expect(updated_job.arguments).to eq({ updated: true, count: 42 })
    end

    it "updates job priority" do
      record = deserialize(
        {
          data: {
            type: "sync:jobs",
            id: job.id,
            attributes: {
              priority: 100
            }
          }
        }
      )

      updated_job = service.update(record)

      expect(updated_job.priority).to eq(100)
    end

    it "updates retry count" do
      record = deserialize(
        {
          data: {
            type: "sync:jobs",
            id: job.id,
            attributes: {
              retry_count: 3
            }
          }
        }
      )

      updated_job = service.update(record)

      expect(updated_job.retry_count).to eq(3)
    end

    it "returns the updated job" do
      record = deserialize(
        {
          data: {
            type: "sync:jobs",
            id: job.id,
            attributes: {
              status: "completed"
            }
          }
        }
      )

      result = service.update(record)

      expect(result).not_to be_nil
      expect(result.id).to eq(job.id)
      expect(result.status).to eq("completed")
    end

    it "persists the changes in the database" do
      record = deserialize(
        {
          data: {
            type: "sync:jobs",
            id: job.id,
            attributes: {
              status: "failed",
              progress: 0.75
            }
          }
        }
      )

      service.update(record)

      # Fetch fresh from database
      fresh_job = service.show(job.id)
      expect(fresh_job.status).to eq("failed")
      expect(fresh_job.progress).to eq(0.75)
    end

    it "raises error when updating non-existent job" do
      fake_uuid = UUIDv7.generate
      record = deserialize(
        {
          data: {
            type: "sync:jobs",
            id: fake_uuid,
            attributes: {
              status: "completed"
            }
          }
        }
      )

      expect {
        service.update(record)
      }.to raise_error(Verse::Error::RecordNotFound)
    end
  end
end
