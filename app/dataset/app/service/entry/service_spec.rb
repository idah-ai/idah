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

  describe "#create" do
    it "creates a new entry" do
      entry = subject.create(attributes)
      expect(entry.priority).to eq(1)
      expect(entry.status).to eq("pending")
    end
  end

  describe "#show" do
    it "shows an entry" do
      entry_id = repo.create(attributes)
      found_entry = subject.show(entry_id)
      expect(found_entry.id).to eq(entry_id)
    end
  end

  describe "#update" do
    it "updates an entry" do
      entry_id = repo.create(attributes)
      record = deserialize(
        {
          data: {
            type: "entries",
            id: entry_id,
            attributes: {
              status: "in_progress",
            }
          }
        }
      )

      subject.update(record)

      updated_entry = repo.find!(entry_id)
      expect(updated_entry.status).to eq("in_progress")
    end
  end

  describe "#delete" do
    it "deletes an entry" do
      entry_id = repo.create(attributes)
      subject.delete(entry_id)
      expect { repo.find!(entry_id) }.to raise_error(Verse::Error::NotFound)
    end
  end
end
