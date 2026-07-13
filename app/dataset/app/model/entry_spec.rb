# frozen_string_literal: true

require "spec_helper"

RSpec.describe Entry, database: true do
  describe Entry::Repository do
    subject{ described_class.new(Verse::Auth::Context.new) }

    it "can be instantiated" do
      expect(subject).to be_a(Entry::Repository)
    end

    describe "#select" do
      let(:user_a_context) do
        Verse::Auth::Context.from_role("admin", metadata: { id: 100, email: "user_a@example.com" })
      end

      let(:user_b_context) do
        Verse::Auth::Context.from_role("admin", metadata: { id: 200, email: "user_b@example.com" })
      end

      let(:repo_a) { described_class.new(user_a_context) }
      let(:repo_b) { described_class.new(user_b_context) }

      let!(:project_id) do
        Project::Repository.new(user_a_context).create(
          name: "Test Project",
          description: "A test project",
          created_by_email: "user_a@example.com",
          organization_id: 1,
        )
      end

      let!(:dataset_id) do
        Dataset::Repository.new(user_a_context).create(
          modality: "image_labeling",
          labels: ["cat", "dog"],
          labeling_configuration: { "width" => 100, "height" => 100 },
          workflow_configuration: {},
          project_id:
        )
      end

      let(:entry_attributes) do
        {
          priority: 1,
          wf_step: "start",
          status: "pending",
          project_id:,
          dataset_id:
        }
      end

      it "claims an unassigned pending entry" do
        entry_id = repo_a.create(entry_attributes)

        repo_b.select(entry_id)

        entry = repo_b.find!(entry_id)
        expect(entry.assigned_to_id).to eq(200)
        expect(entry.assigned_to_email).to eq("user_b@example.com")
        expect(entry.status).to eq("in_progress")
      end

      it "re-selects a pending entry already assigned to the caller" do
        entry_id = repo_a.create(
          entry_attributes.merge(assigned_to_id: 100, assigned_to_email: "user_a@example.com")
        )

        repo_a.select(entry_id)

        entry = repo_a.find!(entry_id)
        expect(entry.assigned_to_id).to eq(100)
        expect(entry.status).to eq("in_progress")
      end

      it "does not steal a pending entry already claimed by another user" do
        entry_id = repo_a.create(
          entry_attributes.merge(assigned_to_id: 100, assigned_to_email: "user_a@example.com")
        )

        expect {
          repo_b.select(entry_id)
        }.to raise_error(Verse::Error::Unauthorized, /already claimed/)

        entry = repo_a.find!(entry_id)
        expect(entry.assigned_to_id).to eq(100)
        expect(entry.assigned_to_email).to eq("user_a@example.com")
        expect(entry.status).to eq("pending")
      end
    end

    describe "#custom_filter :assigned" do
      let(:system_auth_context) { Verse::Auth::Context[:system] }

      subject { described_class.new(system_auth_context) }

      let!(:project_id) do
        Project::Repository.new(system_auth_context).create(
          name: "Filter Project",
          description: "A test project",
          created_by_email: "admin@example.com",
          organization_id: 1,
        )
      end

      let!(:dataset_id) do
        Dataset::Repository.new(system_auth_context).create(
          modality: "image_labeling",
          labels: ["cat", "dog"],
          labeling_configuration: { "width" => 100, "height" => 100 },
          workflow_configuration: {},
          project_id:
        )
      end

      let!(:assigned_entry_id) do
        subject.create(
          priority: 1,
          wf_step: "start",
          status: "in_progress",
          assigned_to_id: 4,
          assigned_to_email: "annotator@example.com",
          project_id:,
          dataset_id:
        )
      end

      let!(:unassigned_entry_id) do
        subject.create(
          priority: 1,
          wf_step: "start",
          status: "pending",
          project_id:,
          dataset_id:
        )
      end

      it "returns only assigned entries for the literal string \"true\" (case-insensitive)" do
        ["true", "TRUE", true].each do |value|
          result = subject.index({ assigned: value })

          expect(result.map(&:id)).to eq([assigned_entry_id]),
                                      "expected #{value.inspect} to select the assigned branch"
        end
      end

      it "treats any value other than the literal string \"true\" as false" do
        ["false", "1", "yes", "garbage"].each do |value|
          result = subject.index({ assigned: value })

          expect(result.map(&:id)).to eq([unassigned_entry_id]),
                                      "expected #{value.inspect} to select the unassigned branch"
        end
      end
    end
  end
end
