# frozen_string_literal: true

require "spec_helper"

RSpec.describe Annotation::Service, database: true do
  let(:auth_context){ Verse::Auth::Context.new }

  subject { described_class.new(auth_context) }

  let(:repo) { Annotation::Repository.new(auth_context) }
  let(:project_repo) { Project::Repository.new(auth_context) }
  let(:dataset_repo) { Dataset::Repository.new(auth_context) }
  let(:entry_repo) { Entry::Repository.new(auth_context) }

  let!(:project_id) do
    project_repo.create(
      name: "Test Project",
      description: "A test project",
      created_by_email: "user@example.com",
      organization_id: 1,
    )
  end

  let!(:dataset_id) do
    dataset_repo.create(
      modality: "image_labeling",
      labels: ["cat", "dog"],
      labeling_configuration: { "width" => 100, "height" => 100 },
      workflow_configuration: {},
      project_id:
    )
  end

  let!(:entry_id) do
    entry_repo.create(
      priority: 1,
      wf_step: "start",
      status: "pending",
      assigned_to_id: 1,
      project_id:,
      dataset_id:
    )
  end

  let(:attributes) do
    {
      project_id:,
      dataset_id:,
      entry_id:,
      dimensions: { x: 10, y: 20, width: 30, height: 40 },
      annotation: { label: "cat" },
      created_by_email: "user@example.com"
    }
  end

  context "as Admin", as: :admin do
    subject { described_class.new(current_auth_context) }

    describe "#create" do
      it "creates a new annotation" do
        record = deserialize(
          {
            data: {
              type: "dataset:annotations",
              attributes:,
              relationships: {
                entry: {
                  data: {
                    type: "dataset:entries",
                    id: entry_id
                  }
                }
              }
            }
          }
        )

        annotation = subject.create(record)
        expect(annotation.annotation).to eq({ label: "cat" })
        expect(annotation.dimensions).to eq({ x: 10, y: 20, width: 30, height: 40 })
        expect(annotation.entry_id).to eq(entry_id)
        expect(annotation.dataset_id).to eq(dataset_id)
        expect(annotation.project_id).to eq(project_id)
      end

      it "raises error when entry is completed" do
        completed_entry_id = entry_repo.create(
          priority: 1,
          wf_step: "done",
          status: "completed",
          assigned_to_id: 1,
          project_id:,
          dataset_id:
        )

        record = deserialize(
          {
            data: {
              type: "dataset:annotations",
              attributes:,
              relationships: {
                entry: {
                  data: {
                    type: "dataset:entries",
                    id: completed_entry_id
                  }
                }
              }
            }
          }
        )

        expect {
          subject.create(record)
        }.to raise_error(Verse::Error::ValidationFailed, /Cannot create annotations on a completed entry/)
      end
    end

    describe "#show" do
      it "shows an annotation" do
        annotation_id = repo.create(attributes)
        found_annotation = subject.show(annotation_id)
        expect(found_annotation.id).to eq(annotation_id)
      end
    end

    describe "#update" do
      it "updates an annotation" do
        annotation_id = repo.create(attributes)
        record = deserialize(
          {
            data: {
              type: "annotations",
              id: annotation_id,
              attributes: {
                annotation: { label: "dog" },
              }
            }
          }
        )

        subject.update(record)

        updated_annotation = repo.find!(annotation_id)
        expect(updated_annotation.annotation).to eq({ label: "dog" })
      end

      it "raises error when annotation belongs to a completed entry" do
        completed_entry_id = entry_repo.create(
          priority: 1,
          wf_step: "done",
          status: "completed",
          assigned_to_id: 1,
          project_id:,
          dataset_id:
        )

        annotation_id = repo.create(attributes.merge(entry_id: completed_entry_id))

        record = deserialize(
          {
            data: {
              type: "annotations",
              id: annotation_id,
              attributes: {
                annotation: { label: "dog" },
              }
            }
          }
        )

        expect {
          subject.update(record)
        }.to raise_error(Verse::Error::ValidationFailed, /Cannot update annotations on a completed entry/)
      end
    end

    describe "#update_attr" do
      it "raises error when annotation belongs to a completed entry" do
        completed_entry_id = entry_repo.create(
          priority: 1,
          wf_step: "done",
          status: "completed",
          assigned_to_id: 1,
          project_id:,
          dataset_id:
        )

        annotation_id = repo.create(attributes.merge(entry_id: completed_entry_id))

        expect {
          subject.update_attr(annotation_id, { annotation: { label: "dog" } })
        }.to raise_error(Verse::Error::ValidationFailed, /Cannot update annotations on a completed entry/)
      end
    end

    describe "#delete" do
      it "deletes an annotation" do
        annotation_id = repo.create(attributes)
        subject.delete(annotation_id)
        expect { repo.find!(annotation_id) }.to raise_error(Verse::Error::NotFound)
      end

      it "raises error when annotation belongs to a completed entry" do
        completed_entry_id = entry_repo.create(
          priority: 1,
          wf_step: "done",
          status: "completed",
          assigned_to_id: 1,
          project_id:,
          dataset_id:
        )

        annotation_id = repo.create(attributes.merge(entry_id: completed_entry_id))

        expect {
          subject.delete(annotation_id)
        }.to raise_error(Verse::Error::ValidationFailed, /Cannot delete annotations on a completed entry/)
      end
    end

    describe "#write_shape" do
      let!(:annotation_id) { repo.create(attributes) }

      def shape_rows
        subject.annotations.client { |db| db[:annotation_shape].where(annotation_id:).all }
      end

      it "writes a shape row" do
        subject.write_shape(annotation_id, "tile-0x0", { rle: "ABC" })

        rows = shape_rows
        expect(rows.size).to eq(1)
        expect(rows.first[:key]).to eq("tile-0x0")
        expect(rows.first[:value]).to eq({ "rle" => "ABC" })
      end

      it "updates an existing shape row in place (row count stays at 1)" do
        subject.write_shape(annotation_id, "tile-0x0", { rle: "ABC" })
        subject.write_shape(annotation_id, "tile-0x0", { rle: "DEF" })

        rows = shape_rows
        expect(rows.size).to eq(1)
        expect(rows.first[:value]).to eq({ "rle" => "DEF" })
      end

      it "writes the same value twice without error" do
        subject.write_shape(annotation_id, "tile-0x0", { rle: "ABC" })
        subject.write_shape(annotation_id, "tile-0x0", { rle: "ABC" })

        expect(shape_rows.size).to eq(1)
      end

      it "deletes a shape row when value is nil" do
        subject.write_shape(annotation_id, "tile-0x0", { rle: "ABC" })
        subject.write_shape(annotation_id, "tile-0x0", nil)

        expect(shape_rows).to be_empty
      end

      it "deleting a non-existent key succeeds silently" do
        expect {
          subject.write_shape(annotation_id, "tile-0x0", nil)
        }.not_to raise_error

        expect(shape_rows).to be_empty
      end

      it "rejects a missing key" do
        expect {
          subject.write_shape(annotation_id, nil, { rle: "ABC" })
        }.to raise_error(Verse::Error::ValidationFailed, /key is required/)

        expect {
          subject.write_shape(annotation_id, "", { rle: "ABC" })
        }.to raise_error(Verse::Error::ValidationFailed, /key is required/)
      end

      it "rejects a value that is neither nil nor a Hash" do
        expect {
          subject.write_shape(annotation_id, "tile-0x0", "not-a-hash")
        }.to raise_error(Verse::Error::ValidationFailed, /value must be null/)
      end

      it "rejects write when annotation belongs to a completed entry" do
        completed_entry_id = entry_repo.create(
          priority: 1,
          wf_step: "done",
          status: "completed",
          assigned_to_id: 1,
          project_id:,
          dataset_id:
        )

        completed_annotation_id = repo.create(attributes.merge(entry_id: completed_entry_id))

        expect {
          subject.write_shape(completed_annotation_id, "tile-0x0", { rle: "ABC" })
        }.to raise_error(Verse::Error::ValidationFailed, /Cannot update annotations on a completed entry/)
      end

      it "rejects delete when annotation belongs to a completed entry" do
        completed_entry_id = entry_repo.create(
          priority: 1,
          wf_step: "done",
          status: "completed",
          assigned_to_id: 1,
          project_id:,
          dataset_id:
        )

        completed_annotation_id = repo.create(attributes.merge(entry_id: completed_entry_id))

        expect {
          subject.write_shape(completed_annotation_id, "tile-0x0", nil)
        }.to raise_error(Verse::Error::ValidationFailed, /Cannot update annotations on a completed entry/)
      end

      it "deleting the parent annotation cascades to shape rows" do
        subject.write_shape(annotation_id, "tile-0x0", { rle: "ABC" })
        subject.write_shape(annotation_id, "tile-0x1", { rle: "DEF" })

        expect(shape_rows.size).to eq(2)

        subject.delete(annotation_id)

        expect(shape_rows).to be_empty
      end
    end

    describe "#show with annotation_shape aggregation" do
      let!(:annotation_id) { repo.create(attributes) }

      it "merges shape rows into dimensions on single fetch" do
        subject.write_shape(annotation_id, "tile-0x0", { rle: "ABC" })
        subject.write_shape(annotation_id, "tile-0x1", { rle: "DEF" })

        record = subject.show(annotation_id)

        expect(record.dimensions).to include(
          x: 10,
          y: 20,
          width: 30,
          height: 40,
          "tile-0x0" => { "rle" => "ABC" },
          "tile-0x1" => { "rle" => "DEF" }
        )
      end

      it "returns dimensions unchanged when there are no shape rows" do
        record = subject.show(annotation_id)

        expect(record.dimensions).to eq({
          x: 10, y: 20, width: 30, height: 40
        })
      end
    end

    describe "#index with annotation_shape aggregation" do
      it "merges shape rows into dimensions for all annotations in the page" do
        annotation1_id = repo.create(attributes.merge(annotation: { label: "cat" }))
        annotation2_id = repo.create(attributes.merge(annotation: { label: "dog" }))

        subject.write_shape(annotation1_id, "tile-0x0", { rle: "ALPHA" })
        subject.write_shape(annotation2_id, "tile-0x0", { rle: "BETA" })
        subject.write_shape(annotation2_id, "tile-0x1", { rle: "GAMMA" })

        results = subject.index

        ann1 = results.find { |r| r.id == annotation1_id }
        ann2 = results.find { |r| r.id == annotation2_id }

        expect(ann1.dimensions["tile-0x0"]).to eq({ "rle" => "ALPHA" })
        expect(ann2.dimensions["tile-0x0"]).to eq({ "rle" => "BETA" })
        expect(ann2.dimensions["tile-0x1"]).to eq({ "rle" => "GAMMA" })

        # Each annotation's original dimensions are preserved
        expect(ann1.dimensions).to include(x: 10, y: 20)
        expect(ann2.dimensions).to include(x: 10, y: 20)

        # No cross-contamination
        expect(ann1.dimensions).not_to have_key("tile-0x1")
      end

      it "does not add shape rows for annotations with none" do
        annotation1_id = repo.create(attributes.merge(annotation: { label: "cat" }))
        annotation2_id = repo.create(attributes.merge(annotation: { label: "dog" }))

        subject.write_shape(annotation1_id, "tile-0x0", { rle: "ALPHA" })

        results = subject.index

        ann2 = results.find { |r| r.id == annotation2_id }
        expect(ann2.dimensions).not_to have_key("tile-0x0")
      end

      it "issues exactly one shape query per index/show call, regardless of annotation count" do
        # Create multiple annotations with shape rows
        ids = [
          repo.create(attributes.merge(annotation: { label: "a" })),
          repo.create(attributes.merge(annotation: { label: "b" })),
          repo.create(attributes.merge(annotation: { label: "c" })),
        ]

        ids.each_with_index do |id, idx|
          subject.write_shape(id, "tile-0x0", { rle: "VAL#{idx}" })
          subject.write_shape(id, "tile-0x1", { rle: "VAL#{idx}b" })
        end

        # Count queries to the annotation_shape table.  Sequel loggers fire
        # once per SQL statement, so we can count how many times the shape
        # table is queried.
        shape_query_count = 0
        logger = ->(msg) {
          shape_query_count += 1 if msg.include?("annotation_shape")
        }

        subject.annotations.client do |db|
          db.loggers << logger
        end

        begin
          results = subject.index
          expect(results.size).to eq(3)

          results.each_with_index do |r, idx|
            expect(r.dimensions["tile-0x0"]).to eq({ "rle" => "VAL#{idx}" })
            expect(r.dimensions["tile-0x1"]).to eq({ "rle" => "VAL#{idx}b" })
          end

          # merge_annotation_shapes should have fired exactly one query
          # against the annotation_shape table (a single IN query for all IDs).
          expect(shape_query_count).to eq(1),
            "Expected exactly 1 annotation_shape query, got #{shape_query_count}"

          # Also verify show issues a single shape query
          shape_query_count = 0
          record = subject.show(ids.first)
          expect(record.dimensions["tile-0x0"]).to eq({ "rle" => "VAL0" })
          expect(record.dimensions["tile-0x1"]).to eq({ "rle" => "VAL0b" })
          expect(shape_query_count).to eq(1),
            "Expected exactly 1 annotation_shape query for show, got #{shape_query_count}"
        ensure
          subject.annotations.client do |db|
            db.loggers.delete(logger)
          end
        end
      end

      it "does not leak shape rows across tenants (different project)" do
        # Create a second project with its own dataset, entry, and annotation
        other_project_id = project_repo.create(
          name: "Other Project",
          description: "Other project",
          created_by_email: "other@example.com",
          organization_id: 2,
        )

        other_dataset_id = dataset_repo.create(
          modality: "image_labeling",
          labels: ["cat", "dog"],
          labeling_configuration: { "width" => 100, "height" => 100 },
          workflow_configuration: {},
          project_id: other_project_id,
        )

        other_entry_id = entry_repo.create(
          priority: 1,
          wf_step: "start",
          status: "pending",
          assigned_to_id: 1,
          project_id: other_project_id,
          dataset_id: other_dataset_id,
        )

        other_annotation_id = repo.create(
          project_id: other_project_id,
          dataset_id: other_dataset_id,
          entry_id: other_entry_id,
          dimensions: { x: 1, y: 2, width: 3, height: 4 },
          annotation: { label: "other" },
          created_by_email: "other@example.com"
        )

        # Write shape rows to the other annotation
        subject.write_shape(other_annotation_id, "tile-0x0", { rle: "OTHER" })

        # The current user's index should NOT include the other project's data
        my_annotation_id = repo.create(attributes)

        results = subject.index
        expect(results.find { |r| r.id == my_annotation_id }).not_to be_nil
        expect(results.find { |r| r.id == other_annotation_id }).to be_nil
      end
    end
  end
end
