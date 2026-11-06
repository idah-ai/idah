# frozen_string_literal: true

require "spec_helper"
require_relative "../annotation/permission_fixtures"

# History visibility must follow annotation visibility exactly: a caller sees
# history rows exactly for the annotations they can read, and none for others.
# The fixtures are shared with annotation/permission_spec.rb.
RSpec.describe AnnotationChange::Service, database: true do
  include_context "annotation permission fixtures"

  # Three annotations in three projects:
  #   first_annotation_id  -> first_project_id  (project_owner + annotator members)
  #   second_annotation_id -> second_project_id (reviewer member)
  #   third_annotation_id  -> third_project_id  (another_annotator member)
  # Account ids: project_owner=3, annotator=4, reviewer=5, another_annotator=6.

  def all_annotation_ids
    [first_annotation_id, second_annotation_id, third_annotation_id]
  end

  def role_context(user_name)
    user = Verse::Spec.users.fetch(user_name)
    Verse::Auth::Context.from_role(
      user[:role],
      custom_scopes: user[:scopes],
      metadata: user[:user_data]
    )
  end

  context "as Organization Owner", as: :org_owner do
    subject { described_class.new(current_auth_context) }

    it "sees history for all annotations in owned orgs" do
      all_annotation_ids

      rows = subject.index({}, items_per_page: 10_000)
      expect(rows.map(&:annotation_id).uniq.sort).to eq(all_annotation_ids.sort)
    end

    it "does not see history of annotations in other orgs" do
      other_project = project_repo.create(
        name: "Other org project",
        created_by_email: "system@example.com",
        organization_id: 999
      )
      other_dataset = dataset_repo.create(
        name: "Other org dataset",
        project_id: other_project,
        modality: "video",
        workflow_configuration: {},
        labeling_configuration: {}
      )
      other_entry = entry_repo.create(
        project_id: other_project,
        dataset_id: other_dataset,
        priority: 1,
        resource: "http://example.com/other.mp4",
        wf_step: "start",
        status: "pending",
        assigned_to_id: reviewer_account_id
      )
      other_annotation_id = annotation_repo.create(
        project_id: other_project,
        dataset_id: other_dataset,
        entry_id: other_entry,
        shape_type: "bb",
        shape_args: { x: 1 },
        category: "other",
        properties: {},
        created_by_email: "system@example.com"
      )

      rows = subject.index({}, items_per_page: 10_000)
      expect(rows.map(&:annotation_id)).not_to include(other_annotation_id)
    end
  end

  context "as Project Owner", as: :project_owner do
    subject { described_class.new(current_auth_context) }

    before do
      project_owner_member_id # assign account 3 to first_project_id
    end

    it "sees history exactly for annotations in the assigned project" do
      all_annotation_ids

      rows = subject.index({}, items_per_page: 10_000)
      expect(rows.map(&:annotation_id).uniq).to eq([first_annotation_id])
    end
  end

  context "as Annotator", as: :annotator do
    subject { described_class.new(current_auth_context) }

    before do
      annotator_member_id # assign account 4 to first_project_id
    end

    it "sees history exactly for annotations in assigned entries" do
      first_annotation_id
      second_annotation_id # in a project account 4 cannot read
      third_annotation_id

      rows = subject.index({}, items_per_page: 10_000)
      expect(rows.map(&:annotation_id).uniq).to eq([first_annotation_id])
    end
  end

  context "as Reviewer", as: :reviewer do
    subject { described_class.new(current_auth_context) }

    before do
      reviewer_member_id # assign account 5 to second_project_id
    end

    it "sees history exactly for annotations in assigned entries" do
      first_annotation_id
      second_annotation_id
      third_annotation_id

      rows = subject.index({}, items_per_page: 10_000)
      expect(rows.map(&:annotation_id).uniq).to eq([second_annotation_id])
    end
  end

  context "as Another Annotator" do
    # A second annotator account (6) in third_project_id.
    before do
      another_annotator_member_id # assign account 6 to third_project_id
    end

    it "sees history exactly for annotations in assigned entries" do
      user = Verse::Spec.users.fetch(:annotator)
      ctx = Verse::Auth::Context.from_role(
        user[:role],
        custom_scopes: user[:scopes],
        metadata: { id: another_annotator_account_id, email: "annotator2@example.com", name: "Annotator 2" }
      )

      service = described_class.new(ctx)
      first_annotation_id
      second_annotation_id
      third_annotation_id

      rows = service.index({}, items_per_page: 10_000)
      expect(rows.map(&:annotation_id).uniq).to eq([third_annotation_id])
    end
  end

  context "as Anonymous", as: :anonymous do
    subject { described_class.new(current_auth_context) }

    it "is rejected exactly as reading annotations is rejected" do
      all_annotation_ids

      # Annotation::Service#index raises Unauthorized for anonymous callers
      # (no role); history follows the same rule.
      expect { Annotation::Service.new(current_auth_context).index({}) }
        .to raise_error(Verse::Error::Unauthorized)
      expect { subject.index({}) }
        .to raise_error(Verse::Error::Unauthorized)
    end
  end

  context "as Admin" do
    it "sees every history row" do
      all_annotation_ids
      admin = role_context(:admin)

      rows = described_class.new(admin).index({}, items_per_page: 10_000)
      expect(rows.map(&:annotation_id).uniq.sort).to eq(all_annotation_ids.sort)
    end
  end
end
