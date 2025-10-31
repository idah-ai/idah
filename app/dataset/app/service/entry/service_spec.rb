# frozen_string_literal: true

require "spec_helper"

RSpec.describe Entry::Service, database: true do
  let(:auth_context){ Verse::Auth::Context.new }

  subject { described_class.new(auth_context) }

  let(:repo) { Entry::Repository.new(auth_context) }
  let(:project_repo) { Project::Repository.new(auth_context) }
  let(:dataset_repo) { Dataset::Repository.new(auth_context) }

  let!(:project_id) do
    project_repo.create(name: "Test Project", description: "A test project", created_by_email: "user@example.com")
  end

  let!(:dataset_id) do
    dataset_repo.create(
      modality: "video",
      labels: ["cat", "dog"],
      labeling_configuration: { "width" => 100, "height" => 100 },
      workflow_configuration: {},
      project_id:
    )
  end

  let(:attributes) do
    {
      priority: 1,
      resource: "http://example.com/video.mp4",
      wf_step: "start",
      status: "pending",
      assigned_to_id: 1,
      dataset_id:
    }
  end

  let(:entry) do
    record = deserialize(
      {
        data: {
          type: "dataset:entries",
          attributes:,
          relationships: {
            dataset: {
              data: {
                type: "dataset:datasets",
                id: dataset_id
              }
            }
          }
        }
      }
    )
    subject.create(record)
  end

  describe "#create" do
    context "when job_id is not provided" do
      before do
        body = {
          data: {
            resource: "http://example.com/video.mp4",
            sizes: ["240p", "360p", "480p", "720p", "1080p", "1440p", "2160p"],
            generate_frames: false,
            generate_thumbnail: true,
            generate_frame_format: "avif",
            generate_frame_framerate: 6,
            streaming_time_per_segment: 10
          }
        }.to_json

        stub_request(:post, "https://idah.example.com//api/v1/media/videos/process").
          with(
            headers: {
              "Accept" => "*/*",
              "Accept-Encoding" => "gzip;q=1.0,deflate;q=0.6,identity;q=0.3",
              "Host" => "idah.example.com",
              "User-Agent" => "Ruby"
            }
          ).to_return(status: 200, body:, headers: {})

        allow(subject.entries).to receive(:after_commit).and_yield
      end

      it "creates an entry with status pending until job is completed" do
        entry_record = deserialize(
          {
            data: {
              type: "dataset:entries",
              attributes: {
                resource: "http://example.com/video.mp4",
                status: "pending"
              },
              relationships: {
                dataset: {
                  data: {
                    type: "dataset:datasets",
                    id: dataset_id
                  }
                }
              }
            }
          }
        )
        result = subject.create(entry_record)
        expect(result.status).to eq("pending")
      end
    end

    context "when job_id is provided" do
      let(:job_id) { 123 }
      let(:entry_record) do
        deserialize(
          {
            data: {
              type: "dataset:entries",
              attributes: attributes.merge(job_id: job_id),
              relationships: {
                dataset: {
                  data: {
                    type: "dataset:datasets",
                    id: dataset_id
                  }
                }
              }
            }
          }
        )
      end

      context "when the job is done" do
        before do
          body = {
            data: {
              id: job_id,
              type: "media:jobs",
              attributes: {
                status: "completed"
              }
            }
          }.to_json

          stub_request(:get, "https://idah.example.com//api/v1/media/jobs/123").
            with(
              headers: {
                "Accept" => "*/*",
                "Accept-Encoding" => "gzip;q=1.0,deflate;q=0.6,identity;q=0.3",
                "Host" => "idah.example.com",
                "User-Agent" => "Ruby"
              }
            ).to_return(status: 200, body:, headers: {})

          allow(subject.entries).to receive(:after_commit).and_yield
        end
      end

      context "when the job is not done" do
        before do
          stub_request(:get, "http://localhost:3001/jobs/#{job_id}").
            to_return(status: 200,
                      body: {
                        data: {
                          id: job_id,
                          type: "media:jobs",
                          attributes: { status: "running" }
                        }
                      }.to_json,
                      headers: { "Content-Type" => "application/json" })
        end

        it "creates an entry with status pending" do
          result = subject.create(entry_record)
          expect(result.status).to eq("pending")
        end
      end
    end
  end

  describe "#mark_entries_as_ready" do
    let(:job_id) { 456 }

    before do
      repo.create(
        {
          dataset_id: dataset_id,
          job_id: job_id,
          status: "pending"
        }
      )

      repo.create(
        {
          dataset_id: dataset_id,
          job_id: job_id,
          status: "pending"
        }
      )
      repo.create(
        {
          dataset_id: dataset_id,
          job_id: 789,
          status: "pending"
        }
      )
    end

    it "marks entries with the given job_id as ready" do
      subject.mark_entries_as_ready(job_id)

      entries = repo.index({ job_id: job_id })
      expect(entries.map(&:status)).to all(eq("ready"))

      other_entry = repo.index({ job_id: 789 }).first
      expect(other_entry.status).to eq("pending")
    end
  end

  describe "#index" do
    before do
      # Create first entry
      entry

      # Create second entry
      record = deserialize(
        {
          data: {
            type: "dataset:entries",
            attributes: attributes.merge(priority: 2, resource: "http://example.com/video2.mp4"),
            relationships: {
              dataset: {
                data: {
                  type: "dataset:datasets",
                  id: dataset_id
                }
              }
            }
          }
        }
      )
      subject.create(record)
    end

    it "returns all entries when no filter is provided" do
      result = subject.index

      expect(result.count).to eq(2)
    end

    it "filters entries by dataset_id" do
      result = subject.index({ dataset_id: dataset_id })
      expect(result.all? { |e| e.dataset_id == dataset_id }).to be true
    end
  end

  describe "#show" do
    it "shows an entry" do
      found_entry = subject.show(entry.id)
      expect(found_entry.id).to eq(entry.id)
    end

    it "raises error when entry not found" do
      expect { subject.show(UUIDv7.generate) }.to raise_error(Verse::Error::NotFound)
    end
  end

  describe "#update" do
    it "updates an entry" do
      record = deserialize(
        {
          data: {
            type: "entries",
            id: entry.id,
            attributes: {
              status: "in_progress",
            }
          }
        }
      )

      subject.update(record)

      updated_entry = repo.find!(entry.id)
      expect(updated_entry.status).to eq("in_progress")
    end
  end

  describe "#assign_member" do
    it "assigns a member to an entry" do
      record = deserialize(
        {
          data: {
            type: "entries",
            id: entry.id,
            attributes: {
              assigned_to_id: 2,
            }
          }
        }
      )

      subject.assign_member(record.id, 2)

      updated_entry = repo.find!(record.id)
      expect(updated_entry.assigned_to_id).to eq(2)
    end
  end

  describe "#delete" do
    it "deletes an entry" do
      subject.delete(entry.id)
      expect { repo.find!(entry.id) }.to raise_error(Verse::Error::NotFound)
    end
  end

  describe "#update_entries_job" do
    let(:job_id) { 789 }
    let(:resource) { "test-resource.jpg" }
    let!(:test_entry_id) do
      repo.create(
        {
          dataset_id: dataset_id,
          resource: resource,
          status: "pending"
        }
      )
    end

    context "when entry exists and has no job_id" do
      it "updates the entry with the provided job_id" do
        result = subject.update_entries_job(job_id, resource)

        expect(result.job_id).to eq(job_id)
        expect(result.resource).to eq(resource)
        expect(result.id).to eq(test_entry_id)
      end
    end

    context "when entry exists but has a different job_id" do
      let(:different_job_id) { 999 }

      before do
        repo.update!(test_entry_id, { job_id: different_job_id })
      end

      it "raises a validation error" do
        expect { subject.update_entries_job(job_id, resource) }
          .to raise_error(Verse::Error::ValidationFailed)
      end
    end

    context "when entry does not exist" do
      it "raises a not found error" do
        expect { subject.update_entries_job(job_id, "non-existent-resource.jpg") }
          .to raise_error(Verse::Error::NotFound)
      end
    end
  end

  describe "#submit" do
    let!(:test_entry) do
      repo.create(
        {
          dataset_id: dataset_id,
          resource: "test-video.mp4",
          status: "ready",
          wf_step: "start"
        }
      )
    end

    context "when transitioning from start to annotate" do
      it "updates the entry workflow step and status" do
        result = subject.submit(test_entry)

        expect(result.wf_step).to eq("annotate")
        expect(result.status).to eq("in_progress")
        expect(result.id).to eq(test_entry)
      end

      it "includes dataset and annotations in the result" do
        result = subject.submit(test_entry)

        expect(result.dataset).not_to be_nil
        expect(result.dataset.id).to eq(dataset_id)
      end
    end

    context "when transitioning from annotate to review" do
      before do
        repo.update!(test_entry, { wf_step: "annotate" })
        # Mock random to always trigger sampling
        allow_any_instance_of(Workflow::EntryWorkflow).to receive(:rand).and_return(0.5)
      end

      it "transitions to review when should_sample? returns true" do
        # Set sample_rate to 1 to ensure sampling
        dataset_repo.update!(dataset_id, { workflow_configuration: { "sample_rate" => 1 } })

        result = subject.submit(test_entry)

        expect(result.wf_step).to eq("review")
        expect(result.status).to eq("in_progress")
      end
    end

    context "when transitioning from annotate to done" do
      before do
        repo.update!(test_entry, { wf_step: "annotate" })
        # Mock random to not trigger sampling
        allow_any_instance_of(Workflow::EntryWorkflow).to receive(:rand).and_return(0.5)
      end

      it "transitions to done when should_sample? returns false" do
        # Set sample_rate to 0 to ensure no sampling
        dataset_repo.update!(dataset_id, { workflow_configuration: { "sample_rate" => 0 } })

        result = subject.submit(test_entry)

        expect(result.wf_step).to eq("done")
        expect(result.status).to eq("completed")
      end
    end

    context "when transitioning from review to done" do
      before do
        repo.update!(test_entry, { wf_step: "review" })
      end

      it "transitions to done when approved is true" do
        result = subject.submit(test_entry, approved: true)

        expect(result.wf_step).to eq("done")
        expect(result.status).to eq("completed")
      end
    end

    context "when transitioning from review to annotate" do
      before do
        repo.update!(test_entry, { wf_step: "review" })
      end

      it "transitions back to annotate when approved is false" do
        result = subject.submit(test_entry, approved: false)

        expect(result.wf_step).to eq("annotate")
        expect(result.status).to eq("in_progress")
      end
    end

    context "when entry does not exist" do
      it "raises a not found error" do
        expect { subject.submit(UUIDv7.generate) }
          .to raise_error(Verse::Error::NotFound)
      end
    end

    context "when review step is missing approved option" do
      before do
        repo.update!(test_entry, { wf_step: "review" })
      end

      it "raises a validation error" do
        expect { subject.submit(test_entry) }
          .to raise_error(Verse::Error::ValidationFailed, /Missing required option :approved/)
      end
    end
  end

  describe "#error" do
    let!(:test_entry) do
      repo.create(
        {
          dataset_id: dataset_id,
          resource: "test-video.mp4",
          status: "in_progress",
          wf_step: "annotate"
        }
      )
    end

    context "when transitioning from annotate to error" do
      it "updates the entry to error state" do
        result = subject.error(test_entry)

        expect(result.wf_step).to eq("error")
        expect(result.status).to eq("errored")
        expect(result.id).to eq(test_entry)
      end
    end

    context "when transitioning from review to error" do
      before do
        repo.update!(test_entry, { wf_step: "review" })
      end

      it "updates the entry to error state" do
        result = subject.error(test_entry)

        expect(result.wf_step).to eq("error")
        expect(result.status).to eq("errored")
      end
    end

    context "when passing optional parameters" do
      it "accepts additional options" do
        result = subject.error(test_entry, message: "Processing failed")

        expect(result.wf_step).to eq("error")
        expect(result.status).to eq("errored")
      end
    end

    context "when entry does not exist" do
      it "raises a not found error" do
        expect { subject.error(UUIDv7.generate) }
          .to raise_error(Verse::Error::NotFound)
      end
    end
  end
end
