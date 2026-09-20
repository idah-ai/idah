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
      shape_type: "bounding-box",
      shape_args: { x: 10, y: 20, width: 30, height: 40 },
      category: "cat",
      properties: { label: "cat" },
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
        expect(annotation.category).to eq("cat")
        expect(annotation.shape_args).to eq({ x: 10, y: 20, width: 30, height: 40 })
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
                properties: { label: "dog" },
              }
            }
          }
        )

        subject.update(record)

        updated_annotation = repo.find!(annotation_id)
        expect(updated_annotation.properties).to eq({ label: "dog" })
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
                properties: { label: "dog" },
              }
            }
          }
        )

        expect {
          subject.update(record)
        }.to raise_error(Verse::Error::ValidationFailed, /Cannot update annotations on a completed entry/)
      end

      it "strips annotation_shape keys from shape_args before persisting to parent record" do
        annotation_id = repo.create(attributes)

        # Write shape rows so the keys exist in annotation_shape
        subject.write_shape(annotation_id, "tile-0x0", { rle: "ABC" })
        subject.write_shape(annotation_id, "tile-0x1", { rle: "DEF" })

        # Simulate an update where shape_args includes the shape keys (as it would
        # after a read that merged shapes into shape_args)
        record = deserialize(
          {
            data: {
              type: "annotations",
              id: annotation_id,
              attributes: {
                shape_args: {
                  x: 10,
                  y: 20,
                  width: 30,
                  height: 40,
                  "tile-0x0" => { "rle" => "ABC" },
                  "tile-0x1" => { "rle" => "DEF" }
                },
                properties: { label: "dog" }
              }
            }
          }
        )

        subject.update(record)

        # The shape keys must NOT appear in the parent annotations.shape_args column
        raw_shape_args = nil
        subject.annotations.client do |db|
          raw_shape_args = db[:annotations].where(id: annotation_id).get(:shape_args)
        end
        raw = raw_shape_args.respond_to?(:to_h) ? raw_shape_args.to_h : raw_shape_args

        expect(raw).to include("x" => 10, "y" => 20, "width" => 30, "height" => 40)
        expect(raw).not_to have_key("tile-0x0")
        expect(raw).not_to have_key("tile-0x1")

        # The annotation_shape rows must be unaffected
        shape_rows = nil
        subject.annotations.client do |db|
          shape_rows = db[:annotation_shape].where(annotation_id:).all
        end
        expect(shape_rows.size).to eq(2)
        expect(shape_rows.find { |r| r[:key] == "tile-0x0" }[:value]).to eq({ "rle" => "ABC" })
        expect(shape_rows.find { |r| r[:key] == "tile-0x1" }[:value]).to eq({ "rle" => "DEF" })
      end

      it "leaves shape_args unchanged when there are no annotation_shape keys" do
        annotation_id = repo.create(attributes)

        record = deserialize(
          {
            data: {
              type: "annotations",
              id: annotation_id,
              attributes: {
                shape_args: {
                  x: 10,
                  y: 20,
                  width: 50,
                  height: 60
                },
                properties: { label: "dog" }
              }
            }
          }
        )

        subject.update(record)

        raw_shape_args = nil
        subject.annotations.client do |db|
          raw_shape_args = db[:annotations].where(id: annotation_id).get(:shape_args)
        end
        raw = raw_shape_args.respond_to?(:to_h) ? raw_shape_args.to_h : raw_shape_args

        expect(raw).to include("x" => 10, "y" => 20, "width" => 50, "height" => 60)
        expect(raw).not_to have_key("tile-0x0")
      end

      it "works normally for a non-mask annotation (no shape rows at all)" do
        annotation_id = repo.create(attributes)

        record = deserialize(
          {
            data: {
              type: "annotations",
              id: annotation_id,
              attributes: {
                properties: { label: "dog" },
              }
            }
          }
        )

        subject.update(record)

        updated_annotation = repo.find!(annotation_id)
        expect(updated_annotation.properties).to eq({ label: "dog" })
        expect(updated_annotation.shape_args).to include(x: 10, y: 20)
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
          subject.update_attr(annotation_id, { properties: { label: "dog" } })
        }.to raise_error(Verse::Error::ValidationFailed, /Cannot update annotations on a completed entry/)
      end
    end

    describe "#delete" do
      it "soft-deletes an annotation (sets deleted_at/deleted_by_email, keeps the row)" do
        annotation_id = repo.create(attributes)
        subject.delete(annotation_id)

        # The row still exists — it is tombstoned, not removed.
        tombstoned = repo.find!(annotation_id)
        expect(tombstoned.deleted_at).not_to be_nil
        expect(tombstoned.deleted_by_email).to eq("admin@example.com")
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

    describe "#restore" do
      it "clears both deleted_at and deleted_by_email" do
        annotation_id = repo.create(attributes)
        subject.delete(annotation_id)

        restored = subject.restore(annotation_id)
        expect(restored.deleted_at).to be_nil
        expect(restored.deleted_by_email).to be_nil
      end

      it "respects the same completed-entry guard as update" do
        completed_entry_id = entry_repo.create(
          priority: 1,
          wf_step: "done",
          status: "pending",
          assigned_to_id: 1,
          project_id:,
          dataset_id:
        )

        annotation_id = repo.create(attributes.merge(entry_id: completed_entry_id))
        subject.delete(annotation_id)
        entry_repo.update!(completed_entry_id, { status: "completed" })

        expect {
          subject.restore(annotation_id)
        }.to raise_error(Verse::Error::ValidationFailed, /Cannot update annotations on a completed entry/)
      end

      it "round-trips a delete → restore → delete → restore cycle without error" do
        annotation_id = repo.create(attributes)

        2.times do
          subject.delete(annotation_id)
          expect(repo.find!(annotation_id).deleted_at).not_to be_nil

          # restore() must never attempt a duplicate-id create() — it only
          # clears the tombstone on the still-present row.
          subject.restore(annotation_id)
          expect(repo.find!(annotation_id).deleted_at).to be_nil
        end
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

      it "soft-deleting the parent annotation keeps its shape rows" do
        subject.write_shape(annotation_id, "tile-0x0", { rle: "ABC" })
        subject.write_shape(annotation_id, "tile-0x1", { rle: "DEF" })

        expect(shape_rows.size).to eq(2)

        subject.delete(annotation_id)

        # Soft delete never removes the row, so annotation_shape rows survive.
        expect(shape_rows.size).to eq(2)
      end
    end

    describe "#show with annotation_shape aggregation" do
      let!(:annotation_id) { repo.create(attributes) }

      it "merges shape rows into shape_args on single fetch" do
        subject.write_shape(annotation_id, "tile-0x0", { rle: "ABC" })
        subject.write_shape(annotation_id, "tile-0x1", { rle: "DEF" })

        record = subject.show(annotation_id)

        expect(record.shape_args).to include(
          x: 10,
          y: 20,
          width: 30,
          height: 40,
          "tile-0x0" => { "rle" => "ABC" },
          "tile-0x1" => { "rle" => "DEF" }
        )
      end

      it "returns shape_args unchanged when there are no shape rows" do
        record = subject.show(annotation_id)

        expect(record.shape_args).to eq(
          {
            x: 10, y: 20, width: 30, height: 40
          }
        )
      end
    end

    describe "#index with annotation_shape aggregation" do
      it "merges shape rows into shape_args for all annotations in the page" do
        annotation1_id = repo.create(attributes.merge(properties: { label: "cat" }))
        annotation2_id = repo.create(attributes.merge(properties: { label: "dog" }))

        subject.write_shape(annotation1_id, "tile-0x0", { rle: "ALPHA" })
        subject.write_shape(annotation2_id, "tile-0x0", { rle: "BETA" })
        subject.write_shape(annotation2_id, "tile-0x1", { rle: "GAMMA" })

        results = subject.index

        ann1 = results.find { |r| r.id == annotation1_id }
        ann2 = results.find { |r| r.id == annotation2_id }

        expect(ann1.shape_args["tile-0x0"]).to eq({ "rle" => "ALPHA" })
        expect(ann2.shape_args["tile-0x0"]).to eq({ "rle" => "BETA" })
        expect(ann2.shape_args["tile-0x1"]).to eq({ "rle" => "GAMMA" })

        # Each annotation's original shape_args are preserved
        expect(ann1.shape_args).to include(x: 10, y: 20)
        expect(ann2.shape_args).to include(x: 10, y: 20)

        # No cross-contamination
        expect(ann1.shape_args).not_to have_key("tile-0x1")
      end

      it "does not add shape rows for annotations with none" do
        annotation1_id = repo.create(attributes.merge(properties: { label: "cat" }))
        annotation2_id = repo.create(attributes.merge(properties: { label: "dog" }))

        subject.write_shape(annotation1_id, "tile-0x0", { rle: "ALPHA" })

        results = subject.index

        ann2 = results.find { |r| r.id == annotation2_id }
        expect(ann2.shape_args).not_to have_key("tile-0x0")
      end

      it "issues exactly one shape query per index/show call, regardless of annotation count" do
        # Create multiple annotations with shape rows
        ids = [
          repo.create(attributes.merge(properties: { label: "a" })),
          repo.create(attributes.merge(properties: { label: "b" })),
          repo.create(attributes.merge(properties: { label: "c" })),
        ]

        ids.each_with_index do |id, idx|
          subject.write_shape(id, "tile-0x0", { rle: "VAL#{idx}" })
          subject.write_shape(id, "tile-0x1", { rle: "VAL#{idx}b" })
        end

        # Count queries to the annotation_shape table.  Sequel loggers fire
        # once per SQL statement, so we can count how many times the shape
        # table is queried.
        shape_query_count = 0
        logger = Object.new
        logger.define_singleton_method(:info) do |msg|
          shape_query_count += 1 if msg.include?("annotation_shape")
        end

        subject.annotations.client do |db|
          db.loggers << logger
        end

        begin
          results = subject.index
          expect(results.size).to eq(3)

          # index returns annotations ordered by id ASC; UUIDv7 ids generated in
          # the same millisecond have no guaranteed creation order, so look each
          # result up by id instead of relying on positional order.
          expected = {}
          ids.each_with_index do |id, idx|
            expected[id] = {
              "tile-0x0" => { "rle" => "VAL#{idx}" },
              "tile-0x1" => { "rle" => "VAL#{idx}b" },
            }
          end

          results.each do |r|
            expect(r.shape_args["tile-0x0"]).to eq(expected[r.id]["tile-0x0"])
            expect(r.shape_args["tile-0x1"]).to eq(expected[r.id]["tile-0x1"])
          end

          # merge_annotation_shapes should have fired exactly one query
          # against the annotation_shape table (a single IN query for all IDs).
          expect(shape_query_count).to eq(1),
                                       "Expected exactly 1 annotation_shape query, got #{shape_query_count}"

          # Also verify show issues a single shape query
          shape_query_count = 0
          record = subject.show(ids.first)
          expect(record.shape_args["tile-0x0"]).to eq({ "rle" => "VAL0" })
          expect(record.shape_args["tile-0x1"]).to eq({ "rle" => "VAL0b" })
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
          shape_type: "bounding-box",
          shape_args: { x: 1, y: 2, width: 3, height: 4 },
          category: "other",
          properties: { label: "other" },
          created_by_email: "other@example.com"
        )

        # Write shape rows to the other annotation
        subject.write_shape(other_annotation_id, "tile-0x0", { rle: "OTHER" })

        # Verify that fetching our own annotation does not pull in another
        # annotation's shape rows (data integrity, not authorization — this
        # assertion is valid under any role).
        my_annotation_id = repo.create(attributes)

        my_record = subject.show(my_annotation_id)
        expect(my_record.shape_args).not_to have_key("tile-0x0")
        expect(my_record.shape_args).to include(x: 10, y: 20, width: 30, height: 40)
      end
    end

    describe "#full_cycle — create, write_shape, update, delete, restore" do
      it "never stores tile keys in the parent annotations.shape_args column at any point" do
        # Step 1: Create the annotation
        record = deserialize(
          {
            data: {
              type: "dataset:annotations",
              attributes:,
              relationships: {
                entry: {
                  data: { type: "dataset:entries", id: entry_id }
                }
              }
            }
          }
        )
        created = subject.create(record)
        annotation_id = created.id

        # Helper to read raw shape_args from the DB
        raw_shape_args = -> {
          result = nil
          subject.annotations.client { |db| result = db[:annotations].where(id: annotation_id).get(:shape_args) }
          result
        }

        # Step 2: Write shape rows (tiles)
        subject.write_shape(annotation_id, "tile-0x0", { rle: "ABC" })
        subject.write_shape(annotation_id, "tile-0x1", { rle: "DEF" })

        # Raw shape_args must NOT contain tile keys
        expect(raw_shape_args.call).not_to have_key("tile-0x0")
        expect(raw_shape_args.call).not_to have_key("tile-0x1")

        # Step 3: Update the annotation with aggregated shape_args (as a frontend
        # would send after a read that merged shapes into shape_args)
        update_record = deserialize(
          {
            data: {
              type: "annotations",
              id: annotation_id,
              attributes: {
                shape_args: {
                  x: 10, y: 20, width: 30, height: 40,
                  "tile-0x0" => { "rle" => "ABC" },
                  "tile-0x1" => { "rle" => "DEF" }
                },
                properties: { label: "dog" }
              }
            }
          }
        )
        subject.update(update_record)

        # Raw shape_args must still NOT contain tile keys (guard stripped them)
        expect(raw_shape_args.call).not_to have_key("tile-0x0")
        expect(raw_shape_args.call).not_to have_key("tile-0x1")
        # annotation_shape rows must be unaffected
        shape_rows = nil
        subject.annotations.client do |db|
          shape_rows = db[:annotation_shape].where(annotation_id:).all
        end
        expect(shape_rows.size).to eq(2)

        # Step 4: Delete the annotation (soft delete)
        subject.delete(annotation_id)

        # annotation_shape rows must survive soft delete
        subject.annotations.client do |db|
          shape_rows = db[:annotation_shape].where(annotation_id:).all
        end
        expect(shape_rows.size).to eq(2)

        # Step 5: Restore (simulating undo-of-delete). restore() only clears the
        # tombstone on the still-present row — it never attempts a duplicate-id
        # create, and the annotation_shape rows are already intact.
        restored = subject.restore(annotation_id)
        expect(restored.id).to eq(annotation_id)
        expect(restored.deleted_at).to be_nil

        # Raw shape_args must not contain tile keys
        expect(raw_shape_args.call).not_to have_key("tile-0x0")
        expect(raw_shape_args.call).not_to have_key("tile-0x1")

        # Write shapes back (simulating frontend setShape/setShapes after restore)
        subject.write_shape(annotation_id, "tile-0x0", { rle: "ABC" })
        subject.write_shape(annotation_id, "tile-0x1", { rle: "DEF" })

        # Final assertion: raw shape_args still clean
        expect(raw_shape_args.call).not_to have_key("tile-0x0")
        expect(raw_shape_args.call).not_to have_key("tile-0x1")

        # The aggregated read should show tiles merged in
        fetched = subject.show(annotation_id)
        expect(fetched.shape_args["tile-0x0"]).to eq({ "rle" => "ABC" })
        expect(fetched.shape_args["tile-0x1"]).to eq({ "rle" => "DEF" })
      end
    end
  end
end
