# frozen_string_literal: true

require "spec_helper"
require_relative "../../spec_data/annotation_fixture"

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

      describe "retry idempotency (slow client re-sends a create that already succeeded)" do
        let(:annotation_id) { UUIDv7.generate }

        def build_record(overrides = {})
          deserialize(
            {
              data: {
                type: "dataset:annotations",
                id: annotation_id,
                attributes: attributes.merge(id: annotation_id).merge(overrides),
                relationships: {
                  entry: {
                    data: { type: "dataset:entries", id: entry_id }
                  }
                }
              }
            }
          )
        end

        # The spec harness wraps each example in an outer `db.transaction`
        # (without auto_savepoint), so the service's inner `annotations.transaction`
        # would be a no-op that reuses the outer transaction. Wrapping each create
        # in its own savepoint makes the service's transaction a real savepoint,
        # so a duplicate key rolls back only that savepoint — mirroring production,
        # where the service's transaction is a real transaction.
        def in_savepoint(&block)
          subject.annotations.client do |db|
            db.transaction(savepoint: true, auto_savepoint: true, &block)
          end
        end

        it "returns the existing annotation when a duplicate create matches the stored row" do
          # First create persists the row; the re-send hits the duplicate key.
          in_savepoint { subject.create(build_record) }
          duplicate = in_savepoint { subject.create(build_record) }

          expect(duplicate.id).to eq(annotation_id)
          expect(duplicate.category).to eq("cat")
          expect(subject.index.size).to eq(1)
        end

        it "reraises CannotCreateRecord when a nested shape_args value differs" do
          in_savepoint { subject.create(build_record) }

          expect {
            in_savepoint {
              subject.create(build_record(shape_args: { points: [[0, 0], [1, 1]], angle: 0 }))
            }
          }.to raise_error(Verse::Error::CannotCreateRecord)
        end

        it "reraises CannotCreateRecord when a nested properties value differs" do
          in_savepoint { subject.create(build_record) }

          expect {
            in_savepoint {
              subject.create(build_record(properties: { "property-1790676027338" => "different" }))
            }
          }.to raise_error(Verse::Error::CannotCreateRecord)
        end

        it "reraises CannotCreateRecord when the insert failed but no row was persisted" do
          # Can't arise from a duplicate key (if the id existed, the dedup lookup
          # would find it), so simulate the insert failure directly.
          allow(subject.annotations).to receive(:create).and_raise(Verse::Error::CannotCreateRecord)

          expect {
            in_savepoint { subject.create(build_record) }
          }.to raise_error(Verse::Error::CannotCreateRecord)
        end
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

      it "drops a shape key that already sits in the column on its next update" do
        annotation_id = repo.create(attributes)

        # Simulate a tile key that leaked into the column through the old RPC
        # update path, where reads showed the annotation_shape value.
        subject.write_shape(annotation_id, "tile-0x0", { rle: "OLD" })
        leaked_args = attributes[:shape_args].merge("tile-0x0" => { "rle" => "OLD" })
        subject.annotations.client do |db|
          db[:annotations].where(id: annotation_id)
                          .update(shape_args: Sequel.pg_jsonb(leaked_args))
        end

        record = deserialize(
          {
            data: {
              type: "annotations",
              id: annotation_id,
              attributes: {
                shape_args: {
                  x: 10, y: 20, width: 50, height: 40,
                  "tile-0x0" => { "rle" => "OLD" }
                }
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

        expect(raw).not_to have_key("tile-0x0")
        expect(raw["width"]).to eq(50)
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

      it "ignores deleted_at and deleted_by_email (read-only) and never writes version" do
        annotation_id = repo.create(attributes)
        before = repo.client { |db| db[:annotations].where(id: annotation_id).first }

        record = deserialize(
          {
            data: {
              type: "annotations",
              id: annotation_id,
              attributes: {
                deleted_at: Time.now.utc.iso8601,
                deleted_by_email: "attacker@example.com",
                version: 99,
              }
            }
          }
        )

        subject.update(record)

        after = repo.client { |db| db[:annotations].where(id: annotation_id).first }
        expect(after[:deleted_at]).to eq(before[:deleted_at])
        expect(after[:deleted_by_email]).to eq(before[:deleted_by_email])
        expect(after[:version]).to eq(1)
      end
    end

    describe "#update_attr" do
      def create_annotation(overrides = {})
        repo.create(attributes.merge(overrides))
      end

      def other_entry_id(status: "pending", assigned_to_id: 1)
        entry_repo.create(
          priority: 1,
          wf_step: "start",
          status:,
          assigned_to_id:,
          project_id:,
          dataset_id:
        )
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
          subject.update_attr(annotation_id, { properties: { label: "dog" } })
        }.to raise_error(Verse::Error::ValidationFailed, /Cannot update annotations on a completed entry/)
      end

      it "ignores a different entry_id (read-only field), like JSON:API update does" do
        annotation_id = create_annotation
        other = other_entry_id

        subject.update_attr(annotation_id, { properties: { label: "dog" }, entry_id: other })

        updated = repo.find!(annotation_id)
        expect(updated.entry_id).to eq(entry_id)
        expect(updated.properties).to eq({ label: "dog" })
      end

      it "is a no-op when only read-only fields are sent" do
        annotation_id = create_annotation
        before = repo.client { |db| db[:annotations].where(id: annotation_id).first }

        subject.update_attr(annotation_id, { entry_id: other_entry_id })

        after = repo.client { |db| db[:annotations].where(id: annotation_id).first }
        expect(after).to eq(before)
      end

      it "rejects a nil or blank category, like JSON:API update does" do
        annotation_id = create_annotation

        expect {
          subject.update_attr(annotation_id, { category: nil })
        }.to raise_error(Verse::Error::ValidationFailed, /category is required to update an annotation/)

        expect {
          subject.update_attr(annotation_id, { category: "   " })
        }.to raise_error(Verse::Error::ValidationFailed, /category is required to update an annotation/)

        expect(repo.find!(annotation_id).category).to eq("cat")
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

    # ─── Change history (annotation_changes) ────────────────────────────

    describe "change history" do
      # Reads go through AnnotationChange::Repository, whose `changes` encoder
      # decodes the jsonb column into plain values (symbol-keyed hashes), so
      # assertions can compare against plain Ruby values.
      let(:change_repo) { AnnotationChange::Repository.new(Verse::Auth::Context[:system]) }

      def history_rows(annotation_id)
        change_repo.index({ annotation_id: }, items_per_page: 10_000).sort_by(&:version)
      end

      def history_changes(annotation_id, op: nil) # rubocop:disable Naming/MethodParameterName
        rows = history_rows(annotation_id)
        rows = rows.select { |r| r.op == op } if op
        rows.map(&:changes)
      end

      # Created through the admin subject's repository so account_id is the
      # caller (admin, id 1).
      let!(:annotation_id) { subject.annotations.create(attributes) }

      it "create writes version 1 and one created row, with the caller as account_id" do
        row = subject.annotations.client { |db| db[:annotations].where(id: annotation_id).first }
        expect(row[:version]).to eq(1)

        rows = history_rows(annotation_id)
        expect(rows.size).to eq(1)
        expect(rows.first.op).to eq("created")
        expect(rows.first.version).to eq(1)
        expect(rows.first.account_id).to eq(1) # admin
        expect(rows.first.entry_id).to eq(entry_id)
        expect(rows.first.project_id).to eq(project_id)

        changes = rows.first.changes
        expect(changes).to include(["+", "shape_type", nil, "bounding-box"])
        expect(changes).to include(["+", "category", nil, "cat"])
        expect(changes).to include(["+", "shape_args", nil, { "x" => 10, "y" => 20, "width" => 30, "height" => 40 }])
        expect(changes).to include(["+", "properties", nil, { "label" => "cat" }])
        expect(changes.none? { |c| c[1] == "id" }).to be(true)
        expect(changes.none? { |c| c[1] == "created_by_email" }).to be(true)
      end

      it "records a null account_id under a system context" do
        system_service = described_class.new(Verse::Auth::Context[:system])
        id = system_service.annotations.create(attributes)

        rows = history_rows(id)
        expect(rows.size).to eq(1)
        expect(rows.first.account_id).to be_nil
      end

      it "version is never client-settable" do
        # Repository create with version: 7 stores 1.
        id = subject.annotations.create(attributes.merge(version: 7))
        expect(subject.annotations.client { |db| db[:annotations].where(id:).get(:version) }).to eq(1)

        # JSON:API update with a version attribute leaves it as the repository sets it.
        subject.update(
          deserialize(data: { type: "annotations", id: annotation_id, attributes: { version: 99, category: "dog" } })
        )
        expect(subject.annotations.client { |db| db[:annotations].where(id: annotation_id).get(:version) }).to eq(2)

        # RPC update with a version param leaves it as the repository sets it.
        subject.update_attr(annotation_id, { version: 99, category: "cat" })
        expect(subject.annotations.client { |db| db[:annotations].where(id: annotation_id).get(:version) }).to eq(3)
      end

      it "records a video keyframe move under shape_args.frames[frame=N]" do
        video_attributes = attributes.merge(
          shape_type: "idah-video:bounding-box",
          shape_args: AnnotationFixture::VIDEO_SHAPE_ARGS
        )
        video_id = subject.annotations.create(video_attributes)

        subject.update(
          deserialize(
            data: {
              type: "annotations",
              id: video_id,
              attributes: { shape_args: AnnotationFixture::VIDEO_SHAPE_ARGS_MOVED_FRAME_57 }
            }
          )
        )

        rows = history_rows(video_id)
        expect(rows[1].changes).to contain_exactly(
          [
            "~", "shape_args.frames[frame=57].points",
            AnnotationFixture::VIDEO_SHAPE_ARGS["frames"].find { |f| f["frame"] == 57 }["points"],
            AnnotationFixture::VIDEO_SHAPE_ARGS_MOVED_FRAME_57["frames"].find { |f| f["frame"] == 57 }["points"]
          ]
        )
      end

      it "update records exactly the written fields at version 2, with the diff" do
        subject.update(
          deserialize(
            data: {
              type: "annotations",
              id: annotation_id,
              attributes: { category: "dog", properties: { label: "dog" } }
            }
          )
        )

        rows = history_rows(annotation_id)
        expect(rows.map(&:version)).to eq([1, 2])
        expect(rows[1].op).to eq("updated")
        expect(rows[1].changes).to contain_exactly(
          ["~", "category", "cat", "dog"],
          ["~", "properties.label", "cat", "dog"]
        )
      end

      it "a no-op update writes nothing and keeps the version" do
        subject.update(
          deserialize(
            data: {
              type: "annotations",
              id: annotation_id,
              attributes: { category: "cat" }
            }
          )
        )

        rows = history_rows(annotation_id)
        expect(rows.size).to eq(1)
        expect(subject.annotations.client { |db| db[:annotations].where(id: annotation_id).get(:version) }).to eq(1)
      end

      it "two sequential updates record versions 2 and 3, the second row's old values " \
         "matching the first row's new values" do
        subject.update(
          deserialize(data: { type: "annotations", id: annotation_id, attributes: { category: "dog" } })
        )
        subject.update(
          deserialize(
            data: {
              type: "annotations",
              id: annotation_id,
              attributes: { properties: { label: "cat2" } }
            }
          )
        )

        rows = history_rows(annotation_id)
        expect(rows.map(&:version)).to eq([1, 2, 3])
        expect(rows[1].changes).to contain_exactly(["~", "category", "cat", "dog"])
        expect(rows[2].changes).to contain_exactly(["~", "properties.label", "cat", "cat2"])
      end

      it "soft delete then restore record two rows with the tombstone entries and exact events" do
        allow(Verse).to receive(:publish_resource_event).and_call_original

        subject.delete(annotation_id)
        subject.restore(annotation_id)

        rows = history_rows(annotation_id)
        expect(rows.map(&:op)).to eq(["created", "deleted", "restored"])
        expect(rows.map(&:version)).to eq([1, 2, 3])

        deleted = rows[1].changes
        expect(deleted[0][0..1]).to eq(["~", "deleted_at"])
        expect(deleted[0][2]).to be_nil
        # ISO 8601 UTC string with microseconds
        expect(deleted[0][3]).to match(/\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z\z/)
        expect(deleted[1]).to eq(["~", "deleted_by_email", nil, "admin@example.com"])

        restored = rows[2].changes
        expect(restored[0]).to eq(["~", "deleted_at", deleted[0][3], nil])
        expect(restored[1]).to eq(["~", "deleted_by_email", "admin@example.com", nil])

        expect(Verse).to have_received(:publish_resource_event).with(hash_including(event: "deleted")).once
        expect(Verse).to have_received(:publish_resource_event).with(hash_including(event: "restored")).once
        expect(Verse).to have_received(:publish_resource_event).with(hash_including(event: "updated")).exactly(0).times
      end

      it "delete twice: one deleted row, no second write, unchanged state, one event" do
        allow(Verse).to receive(:publish_resource_event).and_call_original

        subject.delete(annotation_id)
        state_after_first = subject.annotations.client { |db| db[:annotations].where(id: annotation_id).first }

        result = subject.delete(annotation_id)
        expect(result).to be_a(Annotation::Record)

        rows = history_rows(annotation_id)
        expect(rows.select { |r| r.op == "deleted" }.size).to eq(1)
        state_after_second = subject.annotations.client { |db| db[:annotations].where(id: annotation_id).first }
        expect(state_after_second[:deleted_at]).to eq(state_after_first[:deleted_at])
        expect(state_after_second[:version]).to eq(2)
        expect(Verse).to have_received(:publish_resource_event).with(hash_including(event: "deleted")).once
      end

      it "restoring a live annotation writes nothing and returns the record" do
        allow(Verse).to receive(:publish_resource_event).and_call_original

        result = subject.restore(annotation_id)
        expect(result).to be_a(Annotation::Record)

        rows = history_rows(annotation_id)
        expect(rows.size).to eq(1)
        expect(Verse).not_to have_received(:publish_resource_event)
      end

      it "write_shape records one updated row per shape write" do
        subject.write_shape(annotation_id, "tile-0x0", { rle: "ABC" })
        subject.write_shape(annotation_id, "tile-0x0", { rle: "DEF" })

        rows = history_rows(annotation_id)
        expect(rows.map(&:op)).to eq(["created", "updated", "updated"])
        expect(rows[1].changes).to contain_exactly(["+", "shape_args.tile-0x0", nil, { "rle" => "ABC" }])
        expect(rows[2].changes).to contain_exactly(["~", "shape_args.tile-0x0.rle", "ABC", "DEF"])
      end

      it "write_shape with a nil value removes the tile (a `-` entry)" do
        subject.write_shape(annotation_id, "tile-0x0", { rle: "ABC" })
        subject.write_shape(annotation_id, "tile-0x0", nil)

        rows = history_rows(annotation_id)
        expect(rows[2].changes).to contain_exactly(["-", "shape_args.tile-0x0", { "rle" => "ABC" }, nil])
      end

      it "write_shape with a nil value on a missing key writes nothing" do
        rows_before = history_rows(annotation_id).size
        subject.write_shape(annotation_id, "tile-0x0", nil)

        expect(history_rows(annotation_id).size).to eq(rows_before)
        expect(subject.annotations.client { |db| db[:annotations].where(id: annotation_id).get(:version) }).to eq(1)
      end

      it "deletion and restoration entries are ISO 8601 UTC strings" do
        subject.delete(annotation_id)
        subject.restore(annotation_id)

        changes = history_changes(annotation_id)
        tombstone = changes[1]
        expect(tombstone.first[3]).to match(/\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z\z/)
      end

      describe "event payloads stay serializable for production" do
        require "verse/ext"

        it "msgpack-packs every resource event payload" do
          captured = []
          allow(Verse).to receive(:publish_resource_event) do |payload: nil, **|
            captured << payload
            nil
          end

          subject.update(
            deserialize(data: { type: "annotations", id: annotation_id, attributes: { category: "cat2" } })
          )
          subject.delete(annotation_id)
          subject.restore(annotation_id)
          subject.update(
            deserialize(data: { type: "annotations", id: annotation_id, attributes: { category: "cat3" } })
          )

          # `let!` created the annotation before the stub, so only the four
          # writes above are captured: updated + deleted + restored + updated.
          expect(captured.size).to eq(4)
          captured.each do |payload|
            expect { payload.to_msgpack }.not_to raise_error
          end
        end
      end

      describe "atomicity" do
        it "rolls back the annotation write when the history insert fails" do
          before = subject.annotations.client { |db| db[:annotations].where(id: annotation_id).first }

          allow_any_instance_of(Annotation::Repository).to receive(:record_change!).and_raise("boom")

          # The spec harness wraps each example in an outer transaction without
          # auto_savepoint, so the service's transactions would join it and a
          # caught exception would not roll back. A real savepoint mirrors
          # production, where the service's transaction is a real transaction.
          expect {
            subject.annotations.client do |db|
              db.transaction(savepoint: true, auto_savepoint: true) do
                subject.update(
                  deserialize(data: { type: "annotations", id: annotation_id, attributes: { category: "dog" } })
                )
              end
            end
          }.to raise_error("boom")

          after = subject.annotations.client { |db| db[:annotations].where(id: annotation_id).first }
          expect(after).to eq(before)
        end
      end

      describe "the full cycle" do
        it "yields versions 1 to 5 and revert of all rows gives the created state" do
          subject.write_shape(annotation_id, "tile-0x0", { rle: "ABC" })
          subject.update(
            deserialize(data: { type: "annotations", id: annotation_id, attributes: { category: "dog" } })
          )
          subject.delete(annotation_id)
          subject.restore(annotation_id)

          rows = history_rows(annotation_id)
          expect(rows.map(&:version)).to eq([1, 2, 3, 4, 5])

          # Revert from the current state (version 5) back to the created state.
          # The created row's `+` entries describe what v1 added; reverting it
          # would remove the fields, so only rows 2..5 are reverted.
          current = {
            shape_args: subject.annotations.client { |db| db[:annotations].where(id: annotation_id).get(:shape_args) },
            category: "dog",
            properties: { label: "cat" }
          }
          changes = rows[1..].reverse.flat_map(&:changes)

          reverted = AnnotationDiff.revert(current, changes)
          expect(reverted["category"]).to eq("cat")
          expect(reverted["properties"]).to eq({ "label" => "cat" })
          expect(reverted["shape_args"]).to eq({ "x" => 10, "y" => 20, "width" => 30, "height" => 40 })
        end
      end
    end
  end
end
