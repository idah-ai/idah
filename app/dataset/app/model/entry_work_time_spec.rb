# frozen_string_literal: true

require "spec_helper"

RSpec.describe EntryWorkTime, database: true do
  let(:system_ctx) { Verse::Auth::Context[:system] }
  let(:project_repo) { Project::Repository.new(system_ctx) }
  let(:dataset_repo) { Dataset::Repository.new(system_ctx) }
  let(:entry_repo) { Entry::Repository.new(system_ctx) }
  let(:repo) { described_class::Repository.new(system_ctx) }

  let!(:project_id) do
    project_repo.create(name: "Proj_test", description: "", organization_id: 1, created_by_email: "alpha@idah.com")
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

  let(:t1) { Time.utc(2026, 11, 3, 10, 30, 15) }

  describe "#upsert_open_row" do
    it "creates an open row with the email" do
      repo.upsert_open_row(entry_id, 10, "annotate", t1, "alpha@idah.com")

      row = repo.table.where(entry_id:, account_id: 10, wf_step: "annotate").first
      expect(row[:session_started_at]).to be_within(1).of(t1)
      expect(row[:email]).to eq("alpha@idah.com")
      expect(row[:seconds]).to eq(0)
    end

    it "keeps the same open row and email on a second call" do
      repo.upsert_open_row(entry_id, 10, "annotate", t1, "alpha@idah.com")
      repo.upsert_open_row(entry_id, 10, "annotate", t1 + 30, "other@b.c")

      rows = repo.table.where(entry_id:, account_id: 10, wf_step: "annotate").all
      expect(rows.size).to eq(1)
      expect(rows.first[:session_started_at]).to be_within(1).of(t1)
      expect(rows.first[:email]).to eq("alpha@idah.com")
    end

    it "opens a new row after the previous one is finalized" do
      repo.upsert_open_row(entry_id, 10, "annotate", t1, "alpha@idah.com")
      row = repo.table.where(entry_id:, account_id: 10).first
      repo.finalize_session(row[:id], 120)

      repo.upsert_open_row(entry_id, 10, "annotate", t1 + 200, "alpha@idah.com")

      rows = repo.table.where(entry_id:, account_id: 10).order(:created_at).all
      expect(rows.size).to eq(2)
      expect(rows[0][:session_started_at]).to be_nil
      expect(rows[1][:session_started_at]).not_to be_nil
    end
  end

  describe "#finalize_session" do
    it "sets seconds and clears session_started_at" do
      repo.upsert_open_row(entry_id, 10, "annotate", t1, "alpha@idah.com")
      row = repo.table.where(entry_id:, account_id: 10).first

      repo.finalize_session(row[:id], 350)

      updated = repo.table.where(id: row[:id]).first
      expect(updated[:seconds]).to eq(350)
      expect(updated[:session_started_at]).to be_nil
    end
  end

  describe "#open_sessions_for" do
    it "returns only rows whose session is still open" do
      repo.upsert_open_row(entry_id, 10, "annotate", t1, "alpha@idah.com")
      repo.upsert_open_row(entry_id, 11, "annotate", t1, "b@b.c")

      closed = repo.table.where(entry_id:, account_id: 10).first
      repo.finalize_session(closed[:id], 120)

      open = repo.open_sessions_for(entry_id, "annotate")
      expect(open.map { |r| r[:account_id] }).to eq([11])
    end
  end

  describe "scoping", as: :annotator do
    subject { EntryWorkTime::Repository.new(current_auth_context) }

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

    it "returns rows for entries assigned to the annotator on :read" do
      repo.upsert_open_row(entry_id, 10, "annotate", t1, "alpha@idah.com")

      # Assign the entry to the annotator (account id 4)
      entry_repo.assign(entry_id, 4, "annotator@example.com")

      result = subject.scoped(:read).all
      expect(result.size).to eq(1)
    end

    it "returns nothing when not assigned" do
      repo.upsert_open_row(entry_id, 10, "annotate", t1, "alpha@idah.com")

      expect(subject.scoped(:read).all).to be_empty
    end
  end

  describe "scoping", as: :org_owner, database: true do
    subject { EntryWorkTime::Repository.new(current_auth_context) }

    let(:system_ctx) { Verse::Auth::Context[:system] }
    let(:repo) { EntryWorkTime::Repository.new(system_ctx) }
    let(:entry_repo) { Entry::Repository.new(system_ctx) }

    let!(:project_id) do
      Project::Repository.new(system_ctx).create(
        name: "Proj_test",
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
        name: "P2", description: "", organization_id: 2, created_by_email: "alpha@idah.com"
      )
    end
    let!(:dataset_org2) do
      Dataset::Repository.new(system_ctx).create(
        modality: "image", labels: [], labeling_configuration: {}, workflow_configuration: {}, project_id: project_org2
      )
    end
    let!(:entry_org2) do
      entry_repo.create(
        priority: 1,
        wf_step: "annotate",
        status: "in_progress",
        assigned_to_id: 10,
        project_id: project_org2,
        dataset_id: dataset_org2
      )
    end

    before do
      repo.upsert_open_row(entry_id, 10, "annotate", Time.utc(2026, 11, 3, 10, 30, 15), "alpha@idah.com")
      repo.upsert_open_row(entry_org2, 10, "annotate", Time.utc(2026, 11, 3, 10, 30, 15), "alpha@idah.com")
    end

    it "returns only rows from the organization's projects on :read" do
      result = subject.scoped(:read).all
      expect(result.size).to eq(1)
      expect(result.first[:entry_id]).to eq(entry_id)
    end

    context "with project scopes only" do
      before do
        allow(current_auth_context).to receive(:custom_scopes).and_return(project: [project_org2])
      end

      it "returns rows scoped to the specified project" do
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
