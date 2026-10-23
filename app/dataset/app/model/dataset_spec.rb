# frozen_string_literal: true

require "spec_helper"

RSpec.describe Dataset, database: true do
  describe Dataset::Repository do
    subject{ described_class.new(Verse::Auth::Context.new) }

    it "can be instantiated" do
      expect(subject).to be_a(Dataset::Repository)
    end

    let(:auth_context) { Verse::Auth::Context[:system] }
    let(:sys_subject)  { Dataset::Repository.new(auth_context) }
    let(:entry_repo)   { Entry::Repository.new(auth_context) }
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
      sys_subject.create(
        modality: "video",
        labels: ["cat", "dog"],
        labeling_configuration: {},
        workflow_configuration: {},
        project_id:
      )
    end

    describe "#configured_category_ids" do
      it "extracts all category IDs from a labeling_configuration hash" do
        record = Dataset::Record.new(
          {
            labeling_configuration: {
              "idah-video:bounding-box" => { values: [{ id: "cat" }, { id: "dog" }] },
              "idah-video:polygon" => { values: [{ id: "bird" }] }
            }
          }
        )

        expect(record.configured_category_ids).to match_array(%w[cat dog bird])
      end

      it "returns empty array for an empty config" do
        record = Dataset::Record.new({ labeling_configuration: {} })

        expect(record.configured_category_ids).to eq([])
      end

      it "skips tool configs that have no values key" do
        record = Dataset::Record.new(
          { labeling_configuration: { "idah-video:bbox" => { not_values: true } } }
        )
        expect(record.configured_category_ids).to eq([])
      end
    end

    describe "#labeling_configuration_updated" do
      it "sets syncing_stats on the dataset during recomputation" do
        service_mock = instance_double(EntryStats::Service)
        allow(service_mock).to receive(:recompute_all_for_dataset)
        allow(EntryStats::Service).to receive(:new).and_return(service_mock)

        sys_subject.labeling_configuration_updated(dataset_id, changed_category_ids: %w[cat dog])

        dataset = sys_subject.find!(dataset_id)
        expect(dataset.syncing_stats).to be true
      end
    end

    describe "#update_progress!" do
      subject { sys_subject }

      # The DB counter trigger only adjusts completed/in_progress counts on a
      # status change (UPDATE), so entries must be created pending then transitioned.
      def add_entry(status)
        id = entry_repo.create({ project_id:, dataset_id:, status: "pending", wf_step: "start" })
        entry_repo.update!(id, { status: }) unless status == "pending"
        id
      end

      it "stays pending when entries exist but none are assigned or completed" do
        add_entry("pending")
        sys_subject.update_progress!(dataset_id)
        expect(sys_subject.find!(dataset_id).status).to eq("pending")
      end

      it "becomes in_progress when an entry is assigned (in_progress)" do
        add_entry("in_progress")
        sys_subject.update_progress!(dataset_id)
        expect(sys_subject.find!(dataset_id).status).to eq("in_progress")
      end

      it "stays in_progress when a submitted entry is pending (awaiting review)" do
        id = entry_repo.create({ project_id:, dataset_id:, status: "pending", wf_step: "review" })
        entry_repo.update!(id, { submitted_by_id: 1, submitted_by_email: "a@example.com" })

        sys_subject.update_progress!(dataset_id)
        expect(sys_subject.find!(dataset_id).status).to eq("in_progress")
      end

      it "becomes in_progress when some but not all entries are completed" do
        add_entry("completed")
        add_entry("pending")
        sys_subject.update_progress!(dataset_id)
        expect(sys_subject.find!(dataset_id).status).to eq("in_progress")
      end

      it "becomes completed when all entries are completed" do
        add_entry("completed")
        sys_subject.update_progress!(dataset_id)
        expect(sys_subject.find!(dataset_id).status).to eq("completed")
      end

      it "does not count errored entries as completed progress" do
        add_entry("errored")
        sys_subject.update_progress!(dataset_id)

        dataset = sys_subject.find!(dataset_id)
        expect(dataset.entries_completed_count).to eq(0)
        expect(dataset.progress).to eq(0.0)
        expect(dataset.status).to eq("pending")
      end

      it "counts errored entries in the progress denominator" do
        add_entry("completed")
        add_entry("pending")
        add_entry("pending")
        add_entry("errored")

        sys_subject.update_progress!(dataset_id)

        dataset = sys_subject.find!(dataset_id)
        expect(dataset.progress).to eq(0.25)
        expect(dataset.status).to eq("in_progress")
      end

      it "stays in_progress when completed entries also have errored entries" do
        add_entry("completed")
        add_entry("errored")

        sys_subject.update_progress!(dataset_id)

        dataset = sys_subject.find!(dataset_id)
        expect(dataset.progress).to eq(0.5)
        expect(dataset.status).to eq("in_progress")
      end

      it "excludes submitted errored entries from submitted progress" do
        id = entry_repo.create({ project_id:, dataset_id:, status: "pending", wf_step: "review" })
        entry_repo.update!(id, { submitted_by_id: 1, submitted_by_email: "a@example.com" })
        sys_subject.update_progress!(dataset_id)
        expect(sys_subject.find!(dataset_id).status).to eq("in_progress")

        entry_repo.update!(id, { status: "errored" })
        sys_subject.update_progress!(dataset_id)
        expect(sys_subject.find!(dataset_id).status).to eq("pending")

        entry_repo.update!(id, { status: "pending" })
        sys_subject.update_progress!(dataset_id)
        expect(sys_subject.find!(dataset_id).status).to eq("in_progress")
      end

      it "resets to pending with zero progress when the last entry is deleted" do
        entry_id = add_entry("completed")
        sys_subject.update_progress!(dataset_id)
        expect(sys_subject.find!(dataset_id).status).to eq("completed")

        entry_repo.delete!(entry_id)
        sys_subject.update_progress!(dataset_id)

        dataset = sys_subject.find!(dataset_id)
        expect(dataset.status).to eq("pending")
        expect(dataset.progress).to eq(0.0)
      end

      %w[pending in_progress errored].each do |status|
        it "recalculates progress after deleting a #{status} entry" do
          add_entry("completed")
          entry_id = add_entry(status)
          sys_subject.update_progress!(dataset_id)

          entry_repo.delete!(entry_id)
          sys_subject.update_progress!(dataset_id)

          dataset = sys_subject.find!(dataset_id)
          expect(dataset.progress).to eq(1.0)
          expect(dataset.status).to eq("completed")
        end
      end

      it "recalculates progress after deleting a completed entry" do
        completed_entry_id = add_entry("completed")
        add_entry("pending")
        sys_subject.update_progress!(dataset_id)

        entry_repo.delete!(completed_entry_id)
        sys_subject.update_progress!(dataset_id)

        dataset = sys_subject.find!(dataset_id)
        expect(dataset.progress).to eq(0.0)
        expect(dataset.status).to eq("pending")
      end

      it "reopens a completed dataset to in_progress when a new unassigned entry is added" do
        add_entry("completed")
        sys_subject.update_progress!(dataset_id)
        expect(sys_subject.find!(dataset_id).status).to eq("completed")

        add_entry("pending")
        sys_subject.update_progress!(dataset_id)
        expect(sys_subject.find!(dataset_id).status).to eq("in_progress")
      end

      it "decrements completed counter when a completed entry is moved to in_progress" do
        add_entry("completed")
        subject.update_progress!(dataset_id)

        dataset = subject.find!(dataset_id)
        expect(dataset.entries_completed_count).to eq(1)
        expect(dataset.entries_in_progress_count).to eq(0)

        completed_entry = Entry::Repository.new(auth_context)
                                           .index({ dataset_id: dataset_id, status: "completed" }).first
        Entry::Repository.new(auth_context).update!(completed_entry.id, { status: "in_progress" })

        dataset = subject.find!(dataset_id)
        expect(dataset.entries_completed_count).to eq(0)
        expect(dataset.entries_in_progress_count).to eq(1)

        subject.update_progress!(dataset_id)
        expect(subject.find!(dataset_id).status).to eq("in_progress")
      end
    end
  end
end
