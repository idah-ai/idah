# frozen_string_literal: true

require "spec_helper"

RSpec.describe NoteFeed, database: true do
  describe NoteFeed::Repository do
    subject { described_class.new(Verse::Auth::Context.new) }

    it "can be instantiated" do
      expect(subject).to be_a(NoteFeed::Repository)
    end
  end

  describe "feedback key helpers" do
    subject { NoteFeed::Repository.new(Verse::Auth::Context[:system]) }

    let(:project_repo) { Project::Repository.new(Verse::Auth::Context[:system]) }
    let(:dataset_repo) { Dataset::Repository.new(Verse::Auth::Context[:system]) }
    let(:entry_repo) { Entry::Repository.new(Verse::Auth::Context[:system]) }

    let!(:project_id) do
      project_repo.create(
        name: "Test Project",
        description: "A test project",
        created_by_email: "user@example.com",
        organization_id: 1
      )
    end

    let!(:dataset_id) do
      dataset_repo.create(
        modality: "video",
        labels: ["cat", "dog"],
        labeling_configuration: {},
        workflow_configuration: {},
        project_id:
      )
    end

    let!(:entry_id) do
      entry_repo.create(
        priority: 1,
        resource: "http://example.com/video.mp4",
        wf_step: "review",
        status: "in_progress",
        assigned_to_id: 1,
        project_id:,
        dataset_id:
      )
    end

    before do
      # A feedback-only note (content_md IS NULL) and a text note sharing a key.
      subject.create(
        project_id:,
        dataset_id:,
        entry_id:,
        anchor_type: "entry",
        feedback_keys: %w[key1 key2],
        content_md: nil,
        created_by_email: "user@example.com"
      )
      subject.create(
        project_id:,
        dataset_id:,
        entry_id:,
        anchor_type: "entry",
        feedback_keys: %w[key2 key3],
        content_md: "A note with text",
        created_by_email: "user@example.com"
      )
    end

    describe "#feedback_key_in_use?" do
      it "returns true when a note in the dataset references the key" do
        expect(subject.feedback_key_in_use?(dataset_id, "key1")).to be true
        expect(subject.feedback_key_in_use?(dataset_id, "key2")).to be true
        expect(subject.feedback_key_in_use?(dataset_id, "key3")).to be true
      end

      it "returns false when no note references the key" do
        expect(subject.feedback_key_in_use?(dataset_id, "unknown")).to be false
      end

      it "returns false for a key used in another dataset" do
        expect(subject.feedback_key_in_use?(UUIDv7.generate, "key1")).to be false
      end
    end

    describe "#feedback_keys_in_use" do
      it "returns the distinct keys referenced by any note in the dataset" do
        expect(subject.feedback_keys_in_use(dataset_id)).to match_array(%w[key1 key2 key3])
      end
    end
  end
end
