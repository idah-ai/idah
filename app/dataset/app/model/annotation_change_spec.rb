# frozen_string_literal: true

require "spec_helper"

RSpec.describe AnnotationChange::Repository, database: true do
  let(:auth_context) { Verse::Auth::Context.new }

  subject { described_class.new(auth_context) }

  let(:system_context) { Verse::Auth::Context[:system] }
  let(:project_repo) { Project::Repository.new(system_context) }
  let(:dataset_repo) { Dataset::Repository.new(system_context) }
  let(:entry_repo) { Entry::Repository.new(system_context) }
  let(:annotation_repo) { Annotation::Repository.new(system_context) }

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

  def create_annotation(overrides = {})
    annotation_repo.create(
      {
        project_id:,
        dataset_id:,
        entry_id:,
        shape_type: "bounding-box",
        shape_args: { x: 10, y: 20, width: 30, height: 40 },
        category: "cat",
        properties: { label: "cat" },
        created_by_email: "user@example.com"
      }.merge(overrides)
    )
  end

  describe "annotation version" do
    it "creates annotations at version 1 and never lets a client-supplied version through" do
      annotation_id = create_annotation(version: 7)

      row = subject.client { |db| db[:annotations].where(id: annotation_id).first }
      expect(row[:version]).to eq(1)
    end
  end

  describe "scoped visibility" do
    it "hides all history for a context that cannot read annotations" do
      # A context with no rights for dataset:annotations.read.
      nobody = described_class.new(Verse::Auth::Context.new([]))

      expect { nobody.scoped(:read).first }.to raise_error(Verse::Error::Unauthorized)
    end

    it "exposes history only through the annotation read scope" do
      annotation_id = create_annotation

      subject.client do |db|
        db[:annotation_changes].insert(
          id: UUIDv7.generate,
          annotation_id:,
          entry_id:,
          project_id:,
          op: "updated",
          version: 2,
          changes: Sequel.pg_jsonb([["~", "shape_args.x", nil, 1]]),
          changed_at: Time.now.utc
        )
      end

      admin = Verse::Spec.users.fetch(:admin)
      admin_repo = described_class.new(
        Verse::Auth::Context.from_role(
          admin[:role],
          custom_scopes: admin[:scopes],
          metadata: admin[:user_data]
        )
      )

      expect(admin_repo.index({ annotation_id: })).not_to be_empty
    end

    it "raises Unauthorized for any action other than read" do
      expect { subject.scoped(:update).first }.to raise_error(Verse::Error::Unauthorized)
    end
  end
end
