# frozen_string_literal: true

require "spec_helper"

RSpec.describe Entry::Service, database: true do
  let(:auth_context){ Verse::Auth::Context.new }

  subject { described_class.new(auth_context) }

  let(:repo) { Entry::Repository.new(auth_context) }
  let(:project_repo) { Project::Repository.new(auth_context) }
  let(:dataset_repo) { Dataset::Repository.new(auth_context) }

  let!(:project_id) do
    project_repo.create(name: "Test Project", description: "A test project", created_by_id: 1)
  end

  let!(:dataset_id) do
    dataset_repo.create(
      modality: "image_labeling",
      labels: ["cat", "dog"],
      labeling_configuration: { "width" => 100, "height" => 100 },
      workflow_configuration: {},
      project_id: project_id
    )
  end

  let(:attributes) do
    {
      priority: 1,
      wf_step: "start",
      status: "pending",
      assigned_to_id: 1,
      dataset_id: dataset_id
    }
  end

  let(:entry) do
    record = deserialize(
      {
        data: {
          type: "dataset:entries",
          attributes: attributes,
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
      it "creates an entry with status ready" do
        entry_record = deserialize(
          {
            data: {
              type: "dataset:entries",
              attributes: {},
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
        expect(result.status).to eq("ready")
      end
    end

    context "when job_id is provided" do
      let(:job_id) { 123 }
      let(:entry_record) do
        deserialize(
          {
            data: {
              type: "dataset:entries",
              attributes: {
                job_id: job_id
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
      end

      context "when the job is done" do
        before do
          body = {
            data: {
              id: job_id,
              type: "media:jobs",
              attributes: {
                status: "done"
              }
            }
          }.to_json

          stub_request(:get, "https://idah.example.com//api/media/jobs/123").
         with(
           headers: {
          'Accept'=>'*/*',
          'Accept-Encoding'=>'gzip;q=1.0,deflate;q=0.6,identity;q=0.3',
          'Host'=>'idah.example.com',
          'User-Agent'=>'Ruby'
           }).to_return(status: 200, body:, headers: {})

          allow(subject.entries).to receive(:after_commit).and_yield
        end

        it "creates an entry with status ready" do
          result = subject.create(entry_record)
          expect(result.status).to eq("ready")
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

  describe "#show" do
    it "shows an entry" do
      found_entry = subject.show(entry.id)
      expect(found_entry.id).to eq(entry.id)
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

  describe "#delete" do
    it "deletes an entry" do
      subject.delete(entry.id)
      expect { repo.find!(entry.id) }.to raise_error(Verse::Error::NotFound)
    end
  end
end
