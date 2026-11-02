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

  describe "#recompute_from_annotation" do
    let(:config) do
      {
        "tool" => { values: [{ id: "cat" }, { id: "dog" }] }
      }
    end

    let!(:ds_id) do
      dataset_repo.update!(dataset_id, { labeling_configuration: config })
      dataset_id
    end

    before do
      stat_repo.bulk_insert(
        entry_id,
        { "orphan_category.count" => "1" }
      )
    end

    it "recomputes when entry has existing orphans" do
      subject.recompute_from_annotation(
        entry_id: entry_id,
        dataset_id: ds_id,
        new_category: "dog"
      )

      orphan_stat = stat_repo.index({ entry_id__eq: entry_id, key__eq: "orphan_category.count" }).first
      expect(orphan_stat.value).to eq("0") # was 1, decremented to 0
    end

    it "recomputes when new_category is orphaned even if no orphans exist yet" do
      stat_repo.delete_by_entry_id(entry_id)

      Annotation::Repository.new(auth_context).create(
        entry_id: entry_id,
        project_id: project_id,
        dataset_id: dataset_id,
        shape_type: "idah-image:rect",
        category: "bird",
        shape_args: {},
        created_by_email: "user@example.com"
      )

      subject.recompute_from_annotation(
        entry_id: entry_id,
        dataset_id: ds_id,
        new_category: "bird"
      )

      orphan_stat = stat_repo.index({ entry_id__eq: entry_id, key__eq: "orphan_category.count" }).first
      expect(orphan_stat.value).to eq("1")
    end

    it "skips when no orphans exist and new_category is valid" do
      stat_repo.delete_by_entry_id(entry_id)

      subject.recompute_from_annotation(
        entry_id: entry_id,
        dataset_id: ds_id,
        new_category: "dog"
      )

      stats = stat_repo.index({ entry_id__eq: entry_id })
      expect(stats).to be_empty
    end

    it "skips when new_category is nil (annotation update without category change)" do
      subject.recompute_from_annotation(
        entry_id: entry_id,
        dataset_id: ds_id,
        new_category: nil
      )

      stats = stat_repo.index({ entry_id__eq: entry_id })
      expect(stats.map(&:key)).to include("orphan_category.count") # unchanged
    end
  end

  describe "#recompute_all_for_dataset" do
    let(:annotation_repo) { Annotation::Repository.new(auth_context) }
    let!(:second_entry_id) do
      eid = entry_repo.create(
        priority: 1, wf_step: "annotate", status: "completed", project_id:, dataset_id:
      )

      # Annotations with a known category so the pre-check guard passes
      annotation_repo.create(
        entry_id: eid,
        project_id: project_id,
        dataset_id: dataset_id,
        shape_type: "idah-image:bbox",
        category: "changed_cat",
        shape_args: {},
        created_by_email: "user@example.com"
      )
      eid
    end

    before do
      # Set the first entry to completed so the full recompute path runs
      entry_repo.update!(entry_id, { status: "completed" })

      # Give the first entry an annotation too
      annotation_repo.create(
        entry_id: entry_id,
        project_id: project_id,
        dataset_id: dataset_id,
        shape_type: "idah-image:bbox",
        category: "changed_cat",
        shape_args: {},
        created_by_email: "user@example.com"
      )
    end

    it "recomputes stats for all entries in the dataset" do
      subject.recompute_all_for_dataset(dataset_id, changed_category_ids: ["changed_cat"])

      dataset_entry_ids = entry_repo.index({ dataset_id__eq: dataset_id }).map(&:id)

      dataset_entry_ids.each do |eid|
        stat_keys = stat_repo.index({ entry_id__eq: eid }).map(&:key)
        expect(stat_keys).to include("annotation.count")
      end
    end

    it "recomputes stats for an entry that previously had stale stats" do
      stat_repo.bulk_insert(entry_id, { "annotation.count" => "99", "stale.key" => "old" })

      subject.recompute_all_for_dataset(dataset_id, changed_category_ids: ["changed_cat"])

      refreshed = stat_repo.index({ entry_id__eq: entry_id })
      keys = refreshed.map(&:key)
      expect(keys).not_to include("stale.key")
      expect(refreshed.find { |s| s.key == "annotation.count" }.value).to eq("1")
    end

    it "runs orphan_only for in_progress entries with matching annotations" do
      entry_repo.update!(entry_id, { status: "in_progress" })

      subject.recompute_all_for_dataset(dataset_id, changed_category_ids: ["changed_cat"])

      stats = stat_repo.index({ entry_id__eq: entry_id })
      expect(stats.map(&:key)).to include("orphan_category.count")
      # orphan_only does not persist full stat keys like annotation.count
      expect(stats.map(&:key)).not_to include("annotation.count")
    end

    it "skips in_progress entries when their annotations do not match changed_set" do
      stat_repo.delete_by_entry_id(entry_id)
      entry_repo.update!(entry_id, { status: "in_progress" })

      subject.recompute_all_for_dataset(dataset_id, changed_category_ids: ["other_cat"])

      stats = stat_repo.index({ entry_id__eq: entry_id })
      expect(stats).to be_empty
    end

    it "logs error per entry and clears syncing_stats even when Recompute.call raises" do
      allow(Verse.logger).to receive(:error)
      allow(EntryStats::Recompute).to receive(:call).and_raise("mock failure")

      # Simulate the event method setting the flag before the sweep
      dataset_repo.update!(dataset_id, { syncing_stats: true })

      subject.recompute_all_for_dataset(dataset_id, changed_category_ids: ["changed_cat"])

      expect(Verse.logger).to have_received(:error).with(/mock failure/).at_least(:once)
      expect(dataset_repo.find!(dataset_id).syncing_stats).to be false
    end
  end
end
