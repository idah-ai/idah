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
end
