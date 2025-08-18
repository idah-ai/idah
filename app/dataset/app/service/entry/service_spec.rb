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
