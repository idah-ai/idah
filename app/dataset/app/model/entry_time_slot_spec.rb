# frozen_string_literal: true

require "spec_helper"

RSpec.describe EntryTimeSlot, database: true do
  let(:system_ctx) { Verse::Auth::Context[:system] }
  let(:project_repo) { Project::Repository.new(system_ctx) }
  let(:dataset_repo) { Dataset::Repository.new(system_ctx) }
  let(:entry_repo) { Entry::Repository.new(system_ctx) }
  let(:repo) { described_class::Repository.new(system_ctx) }

  let!(:project_id) do
    project_repo.create(name: "P", description: "", organization_id: 1, created_by_email: "alpha@idah.com")
  end
  let!(:dataset_id) do
    dataset_repo.create(
      modality: "image",
      labels: [],
      labeling_configuration: {},
      workflow_configuration: {},
      project_id:
    )
  end
  let!(:entry_id) do
    entry_repo.create(
      priority: 1,
      wf_step: "annotate",
      status: "in_progress",
      assigned_to_id: 10,
      project_id:,
      dataset_id:
    )
  end

  describe "#insert_slot" do
    it "inserts a slot row" do
      slot_start = Time.utc(2026, 11, 3, 10, 30, 0)
      repo.insert_slot(entry_id, 10, "annotate", slot_start)

      row = repo.table.where(entry_id:, account_id: 10).first
      expect(row[:slot_start]).to eq(slot_start)
      expect(row[:wf_step]).to eq("annotate")
    end

    it "ignores a duplicate (same entry, account, step, slot)" do
      slot_start = Time.utc(2026, 11, 3, 10, 30, 0)
      repo.insert_slot(entry_id, 10, "annotate", slot_start)

      expect do
        repo.insert_slot(entry_id, 10, "annotate", slot_start)
      end.not_to(change { repo.table.count })
    end

    it "allows the same slot for a different account" do
      slot_start = Time.utc(2026, 11, 3, 10, 30, 0)
      repo.insert_slot(entry_id, 10, "annotate", slot_start)
      repo.insert_slot(entry_id, 11, "annotate", slot_start)

      expect(repo.table.where(entry_id:, slot_start:).count).to eq(2)
    end
  end

  describe "scoping", as: :annotator do
    subject { described_class::Repository.new(current_auth_context) }

    before do
      ProjectMember::Repository.new(system_ctx).create(
        project_id:,
        account_id: 4,
        name: "Annotator User",
        email: "annotator@example.com",
        role: "annotator",
        invited_by_id: 1
      )
    end

    it "returns slots for entries assigned to the annotator on :read" do
      repo.insert_slot(entry_id, 10, "annotate", Time.utc(2026, 11, 3, 10, 30, 0))
      entry_repo.assign(entry_id, 4, "annotator@example.com")

      expect(subject.scoped(:read).all.size).to eq(1)
    end

    it "returns nothing when not assigned" do
      repo.insert_slot(entry_id, 10, "annotate", Time.utc(2026, 11, 3, 10, 30, 0))

      expect(subject.scoped(:read).all).to be_empty
    end
  end

  describe "scoping", as: :org_owner, database: true do
    subject { EntryTimeSlot::Repository.new(current_auth_context) }

    let(:system_ctx) { Verse::Auth::Context[:system] }
    let(:repo) { EntryTimeSlot::Repository.new(system_ctx) }
    let(:entry_repo) { Entry::Repository.new(system_ctx) }

    let!(:project_id) do
      Project::Repository.new(system_ctx).create(
        name: "Project_1",
        description: "",
        organization_id: 1,
        created_by_email: "alpha@idah.com"
      )
    end
    let!(:dataset_id) do
      Dataset::Repository.new(system_ctx).create(
        modality: "image", labels: [], labeling_configuration: {}, workflow_configuration: {}, project_id:
      )
    end
    let!(:entry_id) do
      entry_repo.create(
        priority: 1,
        wf_step: "annotate",
        status: "in_progress",
        assigned_to_id: 10,
        project_id:,
        dataset_id:
      )
    end

    let!(:project_org2) do
      Project::Repository.new(system_ctx).create(
        name: "Project_2", description: "", organization_id: 2, created_by_email: "alpha@idah.com"
      )
    end
    let!(:dataset_org2) do
      Dataset::Repository.new(system_ctx).create(
        modality: "image", labels: [], labeling_configuration: {}, workflow_configuration: {}, project_id: project_org2
      )
    end
    let!(:entry_org2) do
      Entry::Repository.new(system_ctx).create(
        priority: 1,
        wf_step: "annotate",
        status: "in_progress",
        assigned_to_id: 10,
        project_id: project_org2,
        dataset_id: dataset_org2
      )
    end

    before do
      repo.insert_slot(entry_id, 10, "annotate", Time.utc(2026, 11, 3, 10, 30, 0))
      repo.insert_slot(entry_org2, 10, "annotate", Time.utc(2026, 11, 3, 10, 30, 0))
    end

    it "returns only slots from the organization's projects on :read" do
      result = subject.scoped(:read).all
      expect(result.size).to eq(1)
      expect(result.first[:entry_id]).to eq(entry_id)
    end

    context "with project scopes only" do
      before do
        allow(current_auth_context).to receive(:custom_scopes).and_return(project: [project_org2])
      end

      it "returns slots scoped to the specified project" do
        result = subject.scoped(:read).all
        expect(result.size).to eq(1)
        expect(result.first[:entry_id]).to eq(entry_org2)
      end
    end

    context "with neither org nor project scopes" do
      before do
        allow(current_auth_context).to receive(:custom_scopes).and_return({})
      end

      it "returns no results" do
        expect(subject.scoped(:read).all).to be_empty
      end
    end
  end
end
