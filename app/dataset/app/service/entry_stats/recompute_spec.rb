# frozen_string_literal: true

require "spec_helper"

RSpec.describe EntryStats::Recompute, database: true do
  let(:auth_context) { Verse::Auth::Context[:system] }

  let(:project_repo) { Project::Repository.new(auth_context) }
  let(:dataset_repo) { Dataset::Repository.new(auth_context) }
  let(:entry_repo)   { Entry::Repository.new(auth_context) }
  let(:stat_repo)    { EntryStat::Repository.new(auth_context) }

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
      project_id:,
      dataset_id:
    )
  end

  def fetch_entry
    entry_repo.find!(entry_id, included: [:dataset, :annotations])
  end

  describe ".call" do
    it "persists core stats for the entry" do
      described_class.call(fetch_entry)

      keys = stat_repo.index({ entry_id__eq: entry_id }).map(&:key)
      expect(keys).to include("annotation.count")
    end

    context "when a plugin generator raises" do
      let(:modality) { "test-recompute-error-modality" }

      before do
        dataset_repo.update!(dataset_id, { modality: modality })

        broken = Class.new do
          def self.generate(_entry, _emit)
            raise "simulated generator failure"
          end
        end
        EntryStats::Registry.register(:test_recompute_plugin, modality, broken)
      end

      after { EntryStats::Registry.clear(:test_recompute_plugin) }

      it "logs the error" do
        expect(Verse.logger).to receive(:error).with(/simulated generator failure/)
        described_class.call(fetch_entry)
      end

      it "still persists core stats despite the plugin failure" do
        allow(Verse.logger).to receive(:error)
        described_class.call(fetch_entry)

        keys = stat_repo.index({ entry_id__eq: entry_id }).map(&:key)
        expect(keys).to include("annotation.count")
      end
    end
  end

  describe ".persist" do
    it "constructs the repository with a real auth context, not nil" do
      expect(EntryStat::Repository).to receive(:new).with(an_instance_of(Verse::Auth::Context)).and_call_original

      described_class.persist(entry_id, { "a" => "1" })
    end
  end

  describe ".collect_plugin_stats" do
    let(:modality) { "test-collect-modality" }
    let(:dataset)  { instance_double(Dataset::Record, modality: modality) }
    let(:entry)    { instance_double(Entry::Record, dataset: dataset) }

    after { EntryStats::Registry.clear(:test_collect_plugin) }

    context "when no generator is registered for the modality" do
      it "leaves stats unchanged" do
        stats = { "annotation.count" => "0" }
        described_class.collect_plugin_stats(entry, stats)
        expect(stats).to eq("annotation.count" => "0")
      end
    end

    context "when a generator is registered" do
      it "merges plugin stats into the shared hash" do
        generator = Class.new do
          def self.generate(_entry, emit)
            emit.call("plugin.custom", 42)
          end
        end
        EntryStats::Registry.register(:test_collect_plugin, modality, generator)

        stats = { "annotation.count" => "0" }
        described_class.collect_plugin_stats(entry, stats)

        expect(stats["plugin.custom"]).to eq("42")
      end

      it "raises StatKeyConflictError when the plugin emits a key that already exists in core stats" do
        conflicting = Class.new do
          def self.generate(_entry, emit)
            emit.call("annotation.count", "999")
          end
        end
        EntryStats::Registry.register(:test_collect_plugin, modality, conflicting)

        expect {
          described_class.collect_plugin_stats(entry, { "annotation.count" => "0" })
        }.to raise_error(described_class::StatKeyConflictError, /annotation\.count/)
      end

      it "raises StatKeyConflictError when the plugin emits the same key twice" do
        duplicate = Class.new do
          def self.generate(_entry, emit)
            emit.call("plugin.stat", "1")
            emit.call("plugin.stat", "2")
          end
        end
        EntryStats::Registry.register(:test_collect_plugin, modality, duplicate)

        expect {
          described_class.collect_plugin_stats(entry, {})
        }.to raise_error(described_class::StatKeyConflictError, /plugin\.stat/)
      end
    end
  end
end
