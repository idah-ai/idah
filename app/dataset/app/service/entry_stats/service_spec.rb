# frozen_string_literal: true

require "spec_helper"

RSpec.describe EntryStats::Service, database: true do
  let(:auth_context) { Verse::Auth::Context[:system] }

  subject { described_class.new(auth_context) }

  let(:project_repo)  { Project::Repository.new(auth_context) }
  let(:dataset_repo)  { Dataset::Repository.new(auth_context) }
  let(:entry_repo)    { Entry::Repository.new(auth_context) }
  let(:stat_repo)     { EntryStat::Repository.new(auth_context) }

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
      modality: "image_labeling",
      labels: ["cat", "dog"],
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
      project_id:,
      dataset_id:
    )
  end

  describe "#index" do
    before do
      stat_repo.bulk_insert(
        entry_id,
        {
          "annotation.count" => "3",
          "category.cat.count" => "2",
          "category.dog.count" => "1"
        }
      )
    end

    it "returns all stats" do
      result = subject.index
      expect(result.map(&:key)).to include("annotation.count", "category.cat.count", "category.dog.count")
    end

    it "filters by entry_id" do
      other_entry_id = entry_repo.create(
        priority: 1, wf_step: "annotate", status: "in_progress", project_id:, dataset_id:
      )
      stat_repo.bulk_insert(other_entry_id, { "annotation.count" => "0" })

      result = subject.index({ entry_id__eq: entry_id })

      expect(result.map(&:entry_id).uniq).to eq([entry_id])
      expect(result.map(&:key)).to include("annotation.count", "category.cat.count")
    end

    it "filters by key" do
      result = subject.index({ key__eq: "annotation.count" })

      expect(result.count).to eq(1)
      expect(result.first.key).to eq("annotation.count")
      expect(result.first.value).to eq("3")
    end
  end

  describe "#show" do
    it "returns a single stat record by id" do
      stat_repo.bulk_insert(entry_id, { "annotation.count" => "7" })
      stat = stat_repo.index({ entry_id__eq: entry_id }).first

      result = subject.show(stat.id)

      expect(result.key).to eq("annotation.count")
      expect(result.value).to eq("7")
    end
  end

  describe "#recompute" do
    it "writes core stats for the entry" do
      subject.recompute(entry_id)

      stats = stat_repo.index({ entry_id__eq: entry_id })
      expect(stats.map(&:key)).to include("annotation.count")
    end

    it "replaces stale stats on recompute" do
      stat_repo.bulk_insert(entry_id, { "annotation.count" => "99", "stale.key" => "old" })

      subject.recompute(entry_id)

      stats = stat_repo.index({ entry_id__eq: entry_id })
      keys = stats.map(&:key)
      expect(keys).not_to include("stale.key")
      expect(stats.find { |s| s.key == "annotation.count" }.value).to eq("0")
    end
  end

  describe "#recompute_all_for_dataset" do
    before do
      # create a second entry in the same dataset
      entry_repo.create(
        priority: 1, wf_step: "annotate", status: "in_progress", project_id:, dataset_id:
      )
    end

    it "recomputes stats for all entries in the dataset" do
      subject.recompute_all_for_dataset(dataset_id)

      dataset_entry_ids = entry_repo.index({ dataset_id__eq: dataset_id }).map(&:id)

      dataset_entry_ids.each do |eid|
        stat_keys = stat_repo.index({ entry_id__eq: eid }).map(&:key)
        expect(stat_keys).to include("annotation.count")
      end
    end

    it "recomputes stats for an entry that previously had stale stats" do
      stat_repo.bulk_insert(entry_id, { "annotation.count" => "99", "stale.key" => "old" })

      subject.recompute_all_for_dataset(dataset_id)

      refreshed = stat_repo.index({ entry_id__eq: entry_id })
      keys = refreshed.map(&:key)
      expect(keys).not_to include("stale.key")
      expect(refreshed.find { |s| s.key == "annotation.count" }.value).to eq("0")
    end
  end
end
