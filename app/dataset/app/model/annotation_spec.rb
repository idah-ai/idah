# frozen_string_literal: true

require "spec_helper"

RSpec.describe Annotation, database: true do
  describe Annotation::Repository do
    subject{ described_class.new(Verse::Auth::Context.new) }

    it "can be instantiated" do
      expect(subject).to be_a(Annotation::Repository)
    end

    let(:auth_context) { Verse::Auth::Context[:system] }
    let(:sys_subject)  { described_class.new(auth_context) }
    let(:project_repo) { Project::Repository.new(auth_context) }
    let(:entry_repo)   { Entry::Repository.new(auth_context) }

    let!(:project_id) do
      project_repo.create(
        name: "Test Project",
        description: "A test project",
        created_by_email: "user@example.com",
        organization_id: 1
      )
    end

    let!(:dataset_id) do
      Dataset::Repository.new(auth_context).create(
        modality: "video",
        labels: [],
        labeling_configuration: {},
        workflow_configuration: {},
        project_id:
      )
    end

    describe "#distinct_annotation_categories" do
      def add_annotation(category)
        eid = entry_repo.create(
          priority: 1,
          project_id:,
          dataset_id:,
          wf_step: "start",
          status: "in_progress"
        )
        sys_subject.create(
          project_id:,
          dataset_id:,
          entry_id: eid,
          shape_type: "idah-image:rect",
          category: category,
          shape_args: {},
          created_by_email: "user@example.com"
        )
      end

      before do
        add_annotation("cat")
        add_annotation("cat")
        add_annotation("dog")
      end

      it "returns distinct categories from live annotations" do
        expect(sys_subject.distinct_annotation_categories(dataset_id))
          .to match_array(%w[cat dog])
      end

      it "excludes deleted annotations" do
        sys_subject.table.where(category: "dog").update(deleted_at: Time.now)

        expect(sys_subject.distinct_annotation_categories(dataset_id))
          .to eq(["cat"])
      end

      it "returns empty array when no live annotations exist" do
        sys_subject.table.where(dataset_id: dataset_id).update(deleted_at: Time.now)

        expect(sys_subject.distinct_annotation_categories(dataset_id))
          .to be_empty
      end
    end
  end
end
