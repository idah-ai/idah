# frozen_string_literal: true

require "spec_helper"
require_relative "../service/annotation/permission_fixtures"

RSpec.describe AnnotationHistoryBackfill, database: true do
  include_context "annotation permission fixtures"

  let(:system_context) { Verse::Auth::Context[:system] }
  let(:annotation_service) { Annotation::Service.new(system_context) }
  let(:change_repo) { AnnotationChange::Repository.new(system_context) }
  let(:change_service) { AnnotationChange::Service.new(system_context) }

  subject { described_class.new }

  # Insert an annotation with a raw insert and no history row, as a
  # pre-migration row. `version` defaults to 1.
  def insert_annotation(overrides = {})
    id = UUIDv7.generate
    annotation_repo.client do |db|
      db[:annotations].insert(
        id: id,
        project_id: first_project_id,
        dataset_id: first_dataset_id,
        entry_id: first_entry_id,
        shape_type: "bb",
        shape_args: Sequel.pg_jsonb({ "x" => 1 }),
        category: "cat",
        properties: Sequel.pg_jsonb({}),
        created_by_email: "reviewer@example.com",
        created_at: Time.now.utc,
        updated_at: Time.now.utc,
        version: 1,
        **overrides
      )
    end
    id
  end

  def baseline_rows(annotation_id)
    change_repo.index({ annotation_id:, version: 1 }, items_per_page: 10_000)
  end

  describe "#run" do
    it "baselines an annotation edited before #682 to the state before the post-#682 rows" do
      id = insert_annotation
      annotation_service.update(
        deserialize(data: { type: "annotations", id: id, attributes: { category: "dog" } })
      )

      inserted, skipped = subject.run

      expect(inserted).to eq(1)
      expect(skipped).to eq(0)
      row = baseline_rows(id).first
      expect(row.op).to eq("baseline")
      expect(row.account_id).to be_nil
      expect(row.account_email).to be_nil
      changes = row.changes
      expect(changes).to include(["+", "category", nil, "cat"])
      expect(changes).to include(["+", "shape_args", nil, { "x" => 1 }])
      expect(changes).not_to include(["+", "category", nil, "dog"])
    end

    it "baselines an untouched annotation to the current state" do
      id = insert_annotation

      subject.run

      row = baseline_rows(id).first
      expect(row.op).to eq("baseline")
      expect(row.changes).to include(["+", "category", nil, "cat"])
      expect(row.changes).to include(["+", "shape_args", nil, { "x" => 1 }])
    end

    it "baselines an annotation soft-deleted before #682 to its pre-delete state" do
      id = insert_annotation
      annotation_service.delete(id)

      subject.run

      row = baseline_rows(id).first
      expect(row.op).to eq("baseline")
      # The baseline predates the deletion: no deleted_at entry.
      expect(row.changes).not_to include(["+", "deleted_at", nil, anything])
      expect(row.changes).to include(["+", "category", nil, "cat"])
    end

    it "leaves an annotation that already has a created row alone" do
      id = first_annotation_id # created through the repo, so it has a version-1 created row

      inserted, skipped = subject.run

      expect(inserted).to eq(0)
      expect(skipped).to eq(1)
      rows = baseline_rows(id)
      expect(rows.size).to eq(1)
      expect(rows.first.op).to eq("created")
    end

    it "inserts nothing on a re-run" do
      id = insert_annotation
      annotation_service.update(
        deserialize(data: { type: "annotations", id: id, attributes: { category: "dog" } })
      )

      subject.run
      inserted, skipped = subject.run

      expect(inserted).to eq(0)
      expect(skipped).to eq(1)
      expect(baseline_rows(id).size).to eq(1)
    end

    it "does not revert a row with a version above the read version" do
      id = insert_annotation
      # Simulate a write that committed after the state read: a version-2 row
      # exists but the annotation is still at version 1, so the cap
      # `version__lte: current.version` must exclude it.
      change_repo.client do |db|
        db[:annotation_changes].insert(
          id: UUIDv7.generate,
          annotation_id: id,
          entry_id: first_entry_id,
          project_id: first_project_id,
          account_id: nil,
          account_email: nil,
          op: "updated",
          version: 2,
          changes: Verse::Sequel::JsonEncoder.encode([["~", "category", "cat", "dog"]]),
          changed_at: Time.now.utc
        )
      end

      subject.run

      row = baseline_rows(id).first
      expect(row.changes).to include(["+", "category", nil, "cat"])
    end

    it "processes more annotations than one batch" do
      ids = Array.new(3) { insert_annotation }

      inserted, skipped = subject.run(items_per_page: 2)

      expect(inserted).to eq(3)
      expect(skipped).to eq(0)
      ids.each { |id| expect(baseline_rows(id).size).to eq(1) }
    end

    it "makes rebuild(id, 1) return the baseline state" do
      id = insert_annotation
      annotation_service.update(
        deserialize(data: { type: "annotations", id: id, attributes: { category: "dog" } })
      )

      subject.run

      rebuilt = change_service.rebuild(id, 1)
      expect(rebuilt.category).to eq("cat")
      expect(rebuilt.shape_args).to eq({ "x" => 1 })
      expect(rebuilt.version).to eq(1)
    end
  end
end
