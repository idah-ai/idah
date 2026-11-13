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

    describe "shape store keys are not memoized across updates" do
      def create_annotation
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
          category: "cat",
          shape_args: {},
          created_by_email: "user@example.com"
        )
      end

      def history_changes(annotation_id)
        change_repo = AnnotationChange::Repository.new(Verse::Auth::Context[:system])
        change_repo.index({ annotation_id: }, items_per_page: 10_000)
                   .sort_by(&:version)
                   .map(&:changes)
      end

      it "does not record a spurious '-' after write_shapes adds a key on the same instance" do
        id = create_annotation

        # First update writes a shape_args key that is not in annotation_shape.
        sys_subject.update(id, { shape_args: { "tile-0x0" => { "rle" => "A" } } })

        # write_shapes moves that key into the child table.
        sys_subject.write_shapes(id, [{ key: "tile-0x0", value: { "rle" => "A" } }])

        # A second update on the same repository instance must see the new
        # annotation_shape key and not diff against a stale memoized copy. It
        # sends shape_args (so the diff actually touches shape_args) with a key
        # that is not in annotation_shape, so the old side must not leak the
        # now-stored tile key as a spurious '-'. The change path is
        # "shape_args.tile-0x0", not "tile-0x0".
        sys_subject.update(id, { shape_args: { "other" => 1 } })

        changes = history_changes(id)
        # The write_shapes row is the last one that records `+ shape_args.tile-0x0`
        # (the first update and the write_shapes both legitimately record it). The
        # second update runs after it, so rows later than that index must not
        # touch the tile key at all.
        write_index = changes.rindex do |row|
          row.any? { |op, path, _old, _new| path == "shape_args.tile-0x0" && op == "+" }
        end

        after = changes.drop(write_index + 1)
        expect(after.any? { |row| row.any? { |entry| entry[1] == "shape_args.tile-0x0" } }).to be(false)
      end
    end
  end
end
