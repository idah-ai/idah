# frozen_string_literal: true

require "spec_helper"
require_relative "../../spec_data/annotation_fixture"
require_relative "../annotation/permission_fixtures"

RSpec.describe AnnotationChange::Service, database: true do
  include_context "annotation permission fixtures"

  let(:system_context) { Verse::Auth::Context[:system] }
  let(:annotation_service) { Annotation::Service.new(system_context) }

  subject { described_class.new(system_context) }

  # A sequence of writes on one annotation, capturing the record after each
  # step so rebuild can be compared against it.
  def build_history
    id = annotation_repo.create(
      project_id: first_project_id,
      dataset_id: first_dataset_id,
      entry_id: first_entry_id,
      shape_type: "idah-video:bounding-box",
      shape_args: AnnotationFixture::VIDEO_SHAPE_ARGS,
      category: "vehicles/car",
      properties: { "occluded" => false },
      created_by_email: "reviewer@example.com"
    )

    states = []
    states << annotation_service.show(id)

    annotation_service.write_shapes(id, [{ key: "tile-0x0", value: { "rle" => "A" } }])
    states << annotation_service.show(id)

    annotation_service.update(
      deserialize(
        data: {
          type: "annotations",
          id: id,
          attributes: {
            shape_args: AnnotationFixture::VIDEO_SHAPE_ARGS_MOVED_FRAME_57,
            category: "vehicles/truck",
            properties: { "occluded" => true }
          }
        }
      )
    )
    states << annotation_service.show(id)

    annotation_service.delete(id)
    states << annotation_service.show(id)

    annotation_service.restore(id)
    states << annotation_service.show(id)

    [id, states]
  end

  describe "#index" do
    it "lists history rows for an annotation, newest first by default" do
      id, = build_history

      rows = subject.index({ annotation_id: id }, items_per_page: 10_000)

      expect(rows.map(&:version)).to eq([5, 4, 3, 2, 1])
      expect(rows.map(&:op)).to eq(%w[restored deleted updated updated created])
    end

    it "sorts by changed_at desc then version desc by default" do
      id, = build_history

      rows = subject.index({ annotation_id: id }, items_per_page: 10_000)
      changed_ats = rows.map(&:changed_at)
      expect(changed_ats).to eq(changed_ats.sort.reverse)
    end

    it "filters by op__in" do
      id, = build_history

      rows = subject.index({ annotation_id: id, op__in: %w[deleted restored] }, items_per_page: 10_000)
      expect(rows.map(&:op)).to contain_exactly("deleted", "restored")
    end

    it "filters by version__gte and version__lte" do
      id, = build_history

      rows = subject.index({ annotation_id: id, version__gte: 2, version__lte: 3 }, items_per_page: 10_000)
      expect(rows.map(&:version)).to contain_exactly(2, 3)
    end

    it "filters by changed_at__gte and changed_at__lte" do
      id, = build_history

      rows = subject.index({ annotation_id: id }, items_per_page: 10_000)
      middle = rows.find { |r| r.version == 3 }.changed_at

      gte = subject.index({ annotation_id: id, changed_at__gte: middle }, items_per_page: 10_000)
      expect(gte.map(&:version)).to contain_exactly(3, 4, 5)

      lte = subject.index({ annotation_id: id, changed_at__lte: middle }, items_per_page: 10_000)
      expect(lte.map(&:version)).to contain_exactly(1, 2, 3)
    end

    it "filters by entry_id" do
      id, = build_history

      rows = subject.index({ entry_id: first_entry_id }, items_per_page: 10_000)
      expect(rows.map(&:annotation_id)).to all(eq(id))
    end

    it "filters by account_id" do
      id, = build_history

      # The annotation was created through the system context, so account_id is
      # null. Give it a row with a known account by updating through a caller.
      admin = Verse::Spec.users.fetch(:admin)
      caller = Verse::Auth::Context.from_role(
        admin[:role],
        custom_scopes: admin[:scopes],
        metadata: admin[:user_data]
      )
      Annotation::Repository.new(caller).update(id, { category: "x" })

      rows = subject.index({ annotation_id: id, account_id: 1 }, items_per_page: 10_000)
      expect(rows.map(&:op)).to contain_exactly("updated")
    end
  end

  describe "#show" do
    it "returns a single history row" do
      id, = build_history

      row = subject.show(subject.index({ annotation_id: id }, items_per_page: 1).first.id)
      expect(row.annotation_id).to eq(id)
    end

    it "raises not-found for an unknown row" do
      expect { subject.show(UUIDv7.generate) }.to raise_error(Verse::Error::RecordNotFound)
    end
  end

  describe "#rebuild" do
    it "rebuilds versions 1 to 5 to equal the state after each write" do
      id, states = build_history

      (1..5).each do |version|
        rebuilt = subject.rebuild(id, version)
        expected = states[version - 1]

        expect(rebuilt.id).to eq(expected.id)
        expect(rebuilt.entry_id).to eq(expected.entry_id)
        expect(rebuilt.project_id).to eq(expected.project_id)
        expect(rebuilt.dataset_id).to eq(expected.dataset_id)
        expect(rebuilt.shape_type).to eq(expected.shape_type)

        # Rebuild returns string-keyed normalized values (AnnotationDiff
        # normalizes keys deep), so compare against normalized expectations.
        expect(rebuilt.shape_args).to eq(AnnotationDiff.normalize(expected.shape_args))
        expect(rebuilt.category).to eq(expected.category)
        expect(rebuilt.properties).to eq(AnnotationDiff.normalize(expected.properties))
        expect(rebuilt.metadata).to eq(AnnotationDiff.normalize(expected.metadata))
        expect(rebuilt.deleted_at).to eq(expected.deleted_at)
        expect(rebuilt.deleted_by_email).to eq(expected.deleted_by_email)
        expect(rebuilt.version).to eq(version)

        # The rebuilt updated_at equals the changed_at of that version's row.
        target_row = subject.index({ annotation_id: id, version: }, items_per_page: 1).first
        expect(rebuilt.updated_at).to eq(target_row.changed_at)
      end
    end

    it "rebuilds an annotation that existed before the migration (no created row)" do
      # Insert with a raw insert and no history row, as a pre-migration row.
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
          version: 1
        )
      end

      # First recorded change is version 2.
      annotation_service.update(
        deserialize(data: { type: "annotations", id: id, attributes: { category: "dog" } })
      )

      rebuilt = subject.rebuild(id, 1)
      expect(rebuilt.category).to eq("cat")
      expect(rebuilt.shape_args).to eq({ "x" => 1 })
      expect(rebuilt.version).to eq(1)
      expect(rebuilt.updated_at).to be_nil
    end

    it "rejects a version above the current version" do
      id, = build_history

      expect { subject.rebuild(id, 99) }
        .to raise_error(Verse::Error::ValidationFailed, /above the current version/)
    end

    it "rejects a version below 1" do
      id, = build_history

      expect { subject.rebuild(id, 0) }
        .to raise_error(Verse::Error::ValidationFailed, /version must be >= 1/)
    end

    it "raises not-found for an unknown annotation" do
      expect { subject.rebuild(UUIDv7.generate, 1) }
        .to raise_error(Verse::Error::RecordNotFound)
    end

    it "raises not-found for an annotation the caller cannot read" do
      id, = build_history

      # The reviewer (account 5) is a member of second_project_id only, so they
      # can read annotations in general but not one in first_project_id.
      reviewer = Verse::Spec.users.fetch(:reviewer)
      outsider = Verse::Auth::Context.from_role(
        reviewer[:role],
        custom_scopes: reviewer[:scopes],
        metadata: reviewer[:user_data]
      )
      reviewer_member_id # assign account 5 to second_project_id
      service = described_class.new(outsider)

      expect { service.rebuild(id, 1) }.to raise_error(Verse::Error::RecordNotFound)
    end
  end
end
