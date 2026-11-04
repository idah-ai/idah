# frozen_string_literal: true

require "spec_helper"

RSpec.describe TimeTracking do
  describe ".slot_for" do
    it "rounds down to the even 2-minute boundary" do
      time = Time.utc(2026, 11, 3, 10, 31, 10)
      expect(described_class.slot_for(time)).to eq(Time.utc(2026, 11, 3, 10, 30, 0))
    end

    it "preserves an exact boundary" do
      time = Time.utc(2026, 11, 3, 10, 30, 0)
      expect(described_class.slot_for(time)).to eq(time)
    end

    it "handles the boundary at minute 0 (even)" do
      time = Time.utc(2026, 11, 3, 11, 0, 15)
      expect(described_class.slot_for(time)).to eq(Time.utc(2026, 11, 3, 11, 0, 0))
    end

    it "handles the boundary at minute 2" do
      time = Time.utc(2026, 11, 3, 11, 3, 59)
      expect(described_class.slot_for(time)).to eq(Time.utc(2026, 11, 3, 11, 2, 0))
    end
  end

  describe ".step_allowed?" do
    it "allows 'annotate'" do
      expect(described_class.step_allowed?("annotate")).to be true
    end

    it "allows 'review'" do
      expect(described_class.step_allowed?("review")).to be true
    end

    it "rejects 'start'" do
      expect(described_class.step_allowed?("start")).to be false
    end

    it "rejects 'done'" do
      expect(described_class.step_allowed?("done")).to be false
    end

    it "rejects 'error'" do
      expect(described_class.step_allowed?("error")).to be false
    end

    it "rejects an unknown step" do
      expect(described_class.step_allowed?("custom_step")).to be false
    end
  end

  describe ".touch", database: true do
    let(:system_ctx) { Verse::Auth::Context[:system] }
    let(:entry_repo) { Entry::Repository.new(system_ctx) }
    let(:slot_repo) { EntryTimeSlot::Repository.new(system_ctx) }
    let(:work_repo) { EntryWorkTime::Repository.new(system_ctx) }
    let(:project_repo) { Project::Repository.new(system_ctx) }
    let(:dataset_repo) { Dataset::Repository.new(system_ctx) }

    let!(:project_id) do
      project_repo.create(name: "P", description: "", organization_id: 1, created_by_email: "user_test@idah.com")
    end
    let!(:dataset_id) do
      dataset_repo.create(modality: "image", labels: [], labeling_configuration: {}, workflow_configuration: {},
                          project_id:)
    end
    let!(:entry_id) do
      entry_repo.create(
        priority: 1, wf_step: "annotate", status: "in_progress",
        assigned_to_id: 10, assigned_to_email: "annotator@example.com",
        project_id:, dataset_id:
      )
    end
    let(:now) { Time.utc(2026, 11, 3, 10, 30, 15) }

    it "inserts a slot and creates an open work-time row" do
      described_class.touch(
        entry_repo:, slot_repo:, work_repo:,
        entry_id:, account_id: 10, email: "annotator@example.com",
        at: now
      )

      slots = slot_repo.table.where(entry_id:, account_id: 10).all
      expect(slots.size).to eq(1)
      expect(slots.first[:slot_start]).to eq(Time.utc(2026, 11, 3, 10, 30, 0))

      rows = work_repo.table.where(entry_id:, account_id: 10, wf_step: "annotate").all
      expect(rows.size).to eq(1)
      expect(rows.first[:session_started_at]).to be_within(1).of(now)
      expect(rows.first[:seconds]).to eq(0)
      expect(rows.first[:email]).to eq("annotator@example.com")
    end

    it "is idempotent when the same slot already exists" do
      slot_start = described_class.slot_for(now)
      slot_repo.insert_slot(entry_id, 10, "annotate", slot_start)

      expect do
        described_class.touch(
          entry_repo:, slot_repo:, work_repo:,
          entry_id:, account_id: 10, email: "annotator@example.com",
          at: now
        )
      end.not_to(change { slot_repo.table.count })
    end

    it "keeps the same open row on a second touch" do
      described_class.touch(
        entry_repo:, slot_repo:, work_repo:,
        entry_id:, account_id: 10, email: "annotator@example.com",
        at: now
      )

      later = now + 30
      described_class.touch(
        entry_repo:, slot_repo:, work_repo:,
        entry_id:, account_id: 10, email: "different@example.com",
        at: later
      )

      rows = work_repo.table.where(entry_id:, account_id: 10, wf_step: "annotate").all
      expect(rows.size).to eq(1)
      expect(rows.first[:session_started_at]).to be_within(1).of(now)
      expect(rows.first[:email]).to eq("annotator@example.com")
    end

    it "does nothing when the caller is not the assignee" do
      described_class.touch(
        entry_repo:, slot_repo:, work_repo:,
        entry_id:, account_id: 99, email: "other@example.com",
        at: now
      )

      expect(slot_repo.table.where(entry_id:).count).to eq(0)
      expect(work_repo.table.where(entry_id:).count).to eq(0)
    end

    it "does nothing when the step is not allowed" do
      start_entry_id = entry_repo.create(
        priority: 1, wf_step: "start", status: "in_progress",
        assigned_to_id: 10,
        project_id:, dataset_id:
      )

      described_class.touch(
        entry_repo:, slot_repo:, work_repo:,
        entry_id: start_entry_id, account_id: 10, email: "annotator@example.com",
        at: now
      )

      expect(slot_repo.table.where(entry_id: start_entry_id).count).to eq(0)
      expect(work_repo.table.where(entry_id: start_entry_id).count).to eq(0)
    end

    context "when the entry is unassigned" do
      let!(:unassigned_entry_id) do
        entry_repo.create(
          priority: 1, wf_step: "annotate", status: "pending",
          assigned_to_id: nil,
          project_id:, dataset_id:
        )
      end

      it "does nothing" do
        described_class.touch(
          entry_repo:, slot_repo:, work_repo:,
          entry_id: unassigned_entry_id, account_id: 10,
          email: "user_test@idah.com", at: now
        )

        expect(slot_repo.table.where(entry_id: unassigned_entry_id).count).to eq(0)
        expect(work_repo.table.where(entry_id: unassigned_entry_id).count).to eq(0)
      end
    end
  end
  describe ".rollup", database: true do
    let(:system_ctx) { Verse::Auth::Context[:system] }
    let(:entry_repo) { Entry::Repository.new(system_ctx) }
    let(:slot_repo) { EntryTimeSlot::Repository.new(system_ctx) }
    let(:work_repo) { EntryWorkTime::Repository.new(system_ctx) }
    let(:project_repo) { Project::Repository.new(system_ctx) }
    let(:dataset_repo) { Dataset::Repository.new(system_ctx) }

    let!(:project_id) do
      project_repo.create(name: "Poject Test", description: "", organization_id: 1, created_by_email: "user_test@idah.com")
    end
    let!(:dataset_id) do
      dataset_repo.create(modality: "image", labels: [], labeling_configuration: {}, workflow_configuration: {},
                          project_id:)
    end
    let!(:entry_id) do
      entry_repo.create(
        priority: 1, wf_step: "annotate", status: "in_progress",
        assigned_to_id: 10,
        project_id:, dataset_id:
      )
    end

    let(:base_time) { Time.utc(2026, 11, 3, 10, 30, 15) }

    def touch_at(account_id:, at:)
      described_class.touch(
        entry_repo:, slot_repo:, work_repo:,
        entry_id:, account_id:, email: "user_test@idah.com", at:
      )
    end

    def do_rollup(submitted_at: Time.now)
      described_class.rollup(
        slot_repo:, work_repo:,
        system_entries_repo: entry_repo,
        entry_id:, wf_step: "annotate", submitted_at:
      )
    end

    it "computes delta for a single session: 10:30:30-10:38:30 slots [10:30,10:32,10:36,10:38] -> 360s" do
      times = [
        Time.utc(2026, 11, 3, 10, 30, 30),
        Time.utc(2026, 11, 3, 10, 32, 10),
        Time.utc(2026, 11, 3, 10, 36, 50),
        Time.utc(2026, 11, 3, 10, 38, 30)
      ]
      times.each { |t| touch_at(account_id: 10, at: t) }
      do_rollup(submitted_at: Time.utc(2026, 11, 3, 10, 38, 30))

      rows = work_repo.table.where(entry_id:, account_id: 10, wf_step: "annotate").all
      expect(rows.size).to eq(1)
      expect(rows.first[:seconds]).to eq(360)
    end

    it "opens a second row for the same author after a rollup" do
      touch_at(account_id: 10, at: base_time)
      do_rollup(submitted_at: base_time + 10)

      later = base_time + 200
      touch_at(account_id: 10, at: later)
      do_rollup(submitted_at: later + 10)

      rows = work_repo.table.where(entry_id:, account_id: 10, wf_step: "annotate")
                       .order(:created_at).all
      expect(rows.size).to eq(2)
      expect(rows[0][:seconds]).to be > 0
      expect(rows[1][:seconds]).to be > 0
    end

    it "rolls up two authors when both have open sessions" do
      touch_at(account_id: 10, at: base_time)
      entry_repo.assign(entry_id, 11, "annot@idah.com")
      touch_at(account_id: 11, at: base_time + 60)
      do_rollup(submitted_at: base_time + 120)

      rows = work_repo.table.where(entry_id:, wf_step: "annotate").all
      expect(rows.size).to eq(2)
      expect(rows.map { |r| r[:account_id] }).to match_array([10, 11])
      rows.each { |r| expect(r[:seconds]).to be > 0 }
    end

    it "finalizes an unassignee's open session when another author submits" do
      touch_at(account_id: 10, at: base_time)
      entry_repo.assign(entry_id, 11, "annot@idah.com")
      touch_at(account_id: 11, at: base_time + 60)
      do_rollup(submitted_at: base_time + 120)

      rows = work_repo.table.where(entry_id:, wf_step: "annotate").all
      expect(rows.map { |r| r[:session_started_at] }).to all(be_nil)
      expect(rows.size).to eq(2)
    end

    it "recomputes the entry cache after rollup" do
      touch_at(account_id: 10, at: base_time)
      do_rollup(submitted_at: base_time + 10)

      entry = entry_repo.find!(entry_id)
      expect(entry.time_tracking).to be_a(Hash)
      expect(entry.time_tracking[:annotate]).to be_a(Integer)
      expect(entry.time_tracking[:annotate]).to be > 0
    end

    it "leaves time_tracking as nil when no rows exist" do
      do_rollup(submitted_at: base_time)
      entry = entry_repo.find!(entry_id)
      expect(entry.time_tracking).to be_nil
    end

    context "two idle-separated bursts with no submit between" do
      it "produces a single row with an approximate total" do
        touch_at(account_id: 10, at: Time.utc(2026, 11, 3, 10, 30, 15))
        touch_at(account_id: 10, at: Time.utc(2026, 11, 3, 10, 33, 25))
        touch_at(account_id: 10, at: Time.utc(2026, 11, 3, 11, 1, 0))
        touch_at(account_id: 10, at: Time.utc(2026, 11, 3, 11, 2, 0))
        do_rollup(submitted_at: Time.utc(2026, 11, 3, 11, 2, 5))

        rows = work_repo.table.where(entry_id:, account_id: 10, wf_step: "annotate").all
        expect(rows.size).to eq(1)

        expect(rows.first[:seconds]).to eq(350)
      end
    end
  end
end
