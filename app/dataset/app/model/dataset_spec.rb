# frozen_string_literal: true

require "spec_helper"

RSpec.describe Dataset, database: true do
  describe Dataset::Repository do
    subject{ described_class.new(Verse::Auth::Context.new) }

    it "can be instantiated" do
      expect(subject).to be_a(Dataset::Repository)
    end
  end

  describe "#update_progress!" do
    let(:auth_context) { Verse::Auth::Context[:system] }

    subject { Dataset::Repository.new(auth_context) }

    let(:entry_repo) { Entry::Repository.new(auth_context) }
    let(:project_repo) { Project::Repository.new(auth_context) }

    let!(:project_id) do
      project_repo.create(
        name: "Test Project",
        description: "A test project",
        created_by_email: "user@example.com",
        organization_id: 1
      )
    end

    let!(:dataset_id) do
      subject.create(
        modality: "video",
        labels: ["cat", "dog"],
        labeling_configuration: {},
        workflow_configuration: {},
        project_id:
      )
    end

    # The DB counter trigger only adjusts completed/in_progress counts on a
    # status change (UPDATE), so entries must be created pending then transitioned.
    def add_entry(status)
      id = entry_repo.create({ project_id:, dataset_id:, status: "pending", wf_step: "start" })
      entry_repo.update!(id, { status: }) unless status == "pending"
      id
    end

    it "stays pending when entries exist but none are assigned or completed" do
      add_entry("pending")
      subject.update_progress!(dataset_id)
      expect(subject.find!(dataset_id).status).to eq("pending")
    end

    it "becomes in_progress when an entry is assigned (in_progress)" do
      add_entry("in_progress")
      subject.update_progress!(dataset_id)
      expect(subject.find!(dataset_id).status).to eq("in_progress")
    end

    it "stays in_progress when a submitted entry is pending (awaiting review)" do
      id = entry_repo.create({ project_id:, dataset_id:, status: "pending", wf_step: "review" })
      entry_repo.update!(id, { submitted_by_id: 1, submitted_by_email: "a@example.com" })

      subject.update_progress!(dataset_id)
      expect(subject.find!(dataset_id).status).to eq("in_progress")
    end

    it "becomes in_progress when some but not all entries are completed" do
      add_entry("completed")
      add_entry("pending")
      subject.update_progress!(dataset_id)
      expect(subject.find!(dataset_id).status).to eq("in_progress")
    end

    it "becomes completed when all entries are completed" do
      add_entry("completed")
      subject.update_progress!(dataset_id)
      expect(subject.find!(dataset_id).status).to eq("completed")
    end

    it "reopens a completed dataset to in_progress when a new unassigned entry is added" do
      add_entry("completed")
      subject.update_progress!(dataset_id)
      expect(subject.find!(dataset_id).status).to eq("completed")

      add_entry("pending")
      subject.update_progress!(dataset_id)
      expect(subject.find!(dataset_id).status).to eq("in_progress")
    end
  end
end
