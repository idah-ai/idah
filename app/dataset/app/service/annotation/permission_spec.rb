# frozen_string_literal: true

require "spec_helper"
require_relative "permission_fixtures"

RSpec.describe Annotation::Service, database: true do
  include_context "annotation permission fixtures"

  # Permission: Organization Owner
  # ------------------------------------------------
  # Annotations   | index | create | update | delete
  # ------------------------------------------------
  # in owned Org     |  yes  |  yes   |   yes  |   yes
  # Not in owned Org |   x   |   x    |    x   |    x
  context "as Organization Owner", as: :org_owner do
    subject { described_class.new(current_auth_context) }

    before do
      @not_owned_org_project = project_repo.create(
        name: "Project xxx",
        created_by_email: "system@example.com",
        organization_id: 999
      )

      @not_owned_org_dataset = dataset_repo.create(
        name: "Dataset xxx",
        project_id: @not_owned_org_project,
        modality: "video",
        workflow_configuration: {},
        labeling_configuration: {}
      )

      @not_owned_org_entry = entry_repo.create(
        project_id: @not_owned_org_project,
        dataset_id: @not_owned_org_dataset,
        priority: 1,
        resource: "http://example.com/first.mp4",
        wf_step: "start",
        status: "pending",
        assigned_to_id: another_annotator_account_id,
      )

      @not_owned_org_annotation = annotation_repo.create(
        project_id: @not_owned_org_project,
        dataset_id: @not_owned_org_dataset,
        entry_id: @not_owned_org_entry,
        shape_type: "bb",
        shape_args: { x: 10, y: 20, width: 30, height: 40 },
        category: "cat",
        properties: {},
        created_by_email: "reviewer@example.com"
      )
    end

    describe "with project in owned org scope" do
      it "can index" do
        # Setup: Create annotations as "Project Owner" can see all annotations in assigned project
        [first_annotation_id, second_annotation_id, third_annotation_id]

        result = subject.index({})

        expect(result.count).to eq 3
        expect(result.map(&:project_id)).to all(satisfy { |pid| pid != @not_owned_org_project })
      end

      it "can create" do
        record = subject.create(deserialize(create_data))

        expect(record.project_id).to eq first_project_id
        expect(record.dataset_id).to eq first_dataset_id
        expect(record.entry_id).to eq first_entry_id
        expect(record.shape_args).to eq({ x: 10, y: 20, width: 30, height: 40 })
        expect(record.category).to eq("cat")
        expect(record.created_by_email).to eq "org_owner@example.com"
      end

      it "can update" do
        record = subject.update(deserialize(update_data))

        expect(record.project_id).to eq first_project_id
        expect(record.dataset_id).to eq first_dataset_id
        expect(record.entry_id).to eq first_entry_id
        expect(record.shape_args).to eq({ x: 11, y: 21, width: 31, height: 41 })
        expect(record.category).to eq("mouse")
      end

      it "can delete" do
        subject.delete(first_annotation_id)

        record = annotation_repo.find!(first_annotation_id)

        expect(record.deleted_at).not_to be nil
        expect(record.deleted_by_email).not_to be nil
      end
    end

    describe "with project not in owned org scope" do
      it "cannot index" do
        result = subject.index({})

        expect(result.count).to eq 0
      end

      it "cannot create with project_id outside org scope" do
        create_data[:data][:relationships][:entry][:data][:id] = @not_owned_org_entry

        expect { subject.create(deserialize(create_data)) }.to raise_error Verse::Error::ValidationFailed
      end

      it "cannot update" do
        update_data[:data][:id] = @not_owned_org_annotation

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(@not_owned_org_annotation)
        }.to raise_error(Verse::Error::RecordNotFound)

        # the record we tried to delete should still be there
        expect { annotation_repo.find!(@not_owned_org_annotation) }.not_to raise_error(Verse::Error::RecordNotFound)
      end
    end
  end

  # Permission: Project Owner
  # ------------------------------------------------
  # Annotations   | index | create | update | delete
  # ------------------------------------------------
  # Assigned      |  yes  |  yes   |   yes  |   yes
  # Not Assigned  |   x   |   x    |    x   |    x
  context "as Project Owner", as: :project_owner do
    subject { described_class.new(current_auth_context) }

    before do
      project_owner_member_id # Assign user to project
    end

    describe "with assigned project" do
      it "can index" do
        # Setup: Create annotations as "Project Owner" can see all annotations in assigned project
        first_annotation_id # assigned
        second_annotation_id # not assigned
        third_annotation_id # not assigned

        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.id).to eq first_annotation_id
      end

      it "can create" do
        record = subject.create(deserialize(create_data))

        expect(record.project_id).to eq first_project_id
        expect(record.dataset_id).to eq first_dataset_id
        expect(record.entry_id).to eq first_entry_id
        expect(record.shape_args).to eq({ x: 10, y: 20, width: 30, height: 40 })
        expect(record.category).to eq("cat")
        expect(record.created_by_email).to eq "project_owner@example.com"
      end

      it "can update" do
        record = subject.update(deserialize(update_data))

        expect(record.project_id).to eq first_project_id
        expect(record.dataset_id).to eq first_dataset_id
        expect(record.entry_id).to eq first_entry_id
        expect(record.shape_args).to eq({ x: 11, y: 21, width: 31, height: 41 })
        expect(record.category).to eq("mouse")
      end

      it "can delete" do
        subject.delete(first_annotation_id)

        record = annotation_repo.find!(first_annotation_id)

        expect(record.deleted_at).not_to be nil
        expect(record.deleted_by_email).not_to be nil
      end
    end

    describe "with assigned project and disabled project member" do
      before do
        project_member_repo.delete(project_owner_member_id) # soft delete
      end

      it "cannot index" do
        # Setup: create note feed to test visibility
        first_annotation_id # assigned

        result = subject.index({})

        expect(result.count).to eq 0
      end
    end

    describe "with not assigned project" do
      it "cannot index" do
        # Setup: Create annotations as "Project Owner" can see all annotations in assigned project
        first_annotation_id # assigned
        second_annotation_id # not assigned
        third_annotation_id # not assigned

        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.map(&:id)).to_not include second_annotation_id, third_annotation_id
      end

      it "cannot create" do
        create_data[:data][:relationships][:entry][:data][:id] = second_entry_id

        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(
          Verse::Error::ValidationFailed,
          "entry not found to create an annotation"
        )
      end

      it "cannot update" do
        update_data[:data][:id] = second_annotation_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(second_annotation_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end
  end

  # Permission: Annotator
  # ------------------------------------------------
  # Annotations   | index | create | update | delete
  # ------------------------------------------------
  # Assigned      |  yes (from assigned entries only)
  # Not Assigned  |   x   |   x    |    x   |    x
  context "as Annotator", as: :annotator do
    subject { described_class.new(current_auth_context) }

    before do
      annotator_member_id # Assign user to project
    end

    describe "with assigned project and assigned entries" do
      it "can index" do
        # Setup: Create annotations as "Annotator" can see all annotations in assigned entries
        first_annotation_id # assigned
        second_annotation_id # not assigned
        third_annotation_id # not assigned

        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.id).to eq first_annotation_id
      end

      it "can create" do
        record = subject.create(deserialize(create_data))

        expect(record.project_id).to eq first_project_id
        expect(record.dataset_id).to eq first_dataset_id
        expect(record.entry_id).to eq first_entry_id
        expect(record.shape_args).to eq({ x: 10, y: 20, width: 30, height: 40 })
        expect(record.category).to eq("cat")
        expect(record.created_by_email).to eq "annotator@example.com"
      end

      it "can update" do
        record = subject.update(deserialize(update_data))

        expect(record.project_id).to eq first_project_id
        expect(record.dataset_id).to eq first_dataset_id
        expect(record.entry_id).to eq first_entry_id
        expect(record.shape_args).to eq({ x: 11, y: 21, width: 31, height: 41 })
        expect(record.category).to eq("mouse")
      end

      it "can delete" do
        subject.delete(first_annotation_id)

        record = annotation_repo.find!(first_annotation_id)

        expect(record.deleted_at).not_to be nil
        expect(record.deleted_by_email).not_to be nil
      end
    end

    describe "with assigned project and disabled project member" do
      before do
        project_member_repo.delete(annotator_member_id) # soft delete
      end

      it "cannot index" do
        # Setup: create note feed to test visibility
        first_annotation_id # assigned

        result = subject.index({})

        expect(result.count).to eq 0
      end
    end

    describe "with assigned project and not assigned entries" do
      before do
        # Add annotator member to third project
        project_member_repo.create(
          project_id: third_project_id,
          account_id: annotator_account_id,
          role: "annotator",
          email: "annotator@example.com",
          invited_by_id: 1
        )
      end

      it "cannot index" do
        # Setup: Create annotations as "Annotator" can see all annotations in assigned project
        first_annotation_id # assigned
        second_annotation_id # not assigned
        third_annotation_id # not assigned

        # Ensure that the annotator is a member of the third project
        member = project_member_repo.find_by!({ account_id: annotator_account_id, project_id: third_project_id })
        expect(member.project_id).to eq third_project_id

        # Ensure that the annotator cannot see unassigned entries in the third project
        result = subject.index({})
        expect(result.count).to eq 1
        expect(result.first.id).to_not eq third_annotation_id
      end

      it "cannot create" do
        create_data[:data][:relationships][:entry][:data][:id] = third_entry_id

        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(
          Verse::Error::ValidationFailed,
          "entry not found to create an annotation"
        )
      end

      it "cannot update" do
        update_data[:data][:id] = third_annotation_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(third_annotation_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    describe "with not assigned project" do
      it "cannot index" do
        # Setup: Create annotations as "Annotator" can see all annotations in assigned project
        first_annotation_id # assigned
        second_annotation_id # not assigned
        third_annotation_id # not assigned

        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.map(&:id)).to_not include second_annotation_id, third_annotation_id
      end

      it "cannot create" do
        create_data[:data][:relationships][:entry][:data][:id] = second_entry_id

        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(
          Verse::Error::ValidationFailed,
          "entry not found to create an annotation"
        )
      end

      it "cannot update" do
        update_data[:data][:id] = second_annotation_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(second_annotation_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end
  end

  # Permission: Reviewer
  # ------------------------------------------------
  # Annotations   | index | create | update | delete
  # ------------------------------------------------
  # Assigned      |  yes (from assigned entries only)
  # Not Assigned  |   x   |   x    |    x   |    x
  context "as Reviewer", as: :reviewer do
    subject { described_class.new(current_auth_context) }

    before do
      reviewer_member_id # Assign user to project
    end

    describe "with assigned project and assigned entries" do
      it "can index" do
        # Setup: Create annotations as "Reviewer" can see all annotations in assigned project
        first_annotation_id # not assigned
        second_annotation_id # assigned
        third_annotation_id # not assigned

        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.id).to eq second_annotation_id
      end

      it "can create" do
        create_data[:data][:relationships][:entry][:data][:id] = second_entry_id

        record = subject.create(deserialize(create_data))

        expect(record.project_id).to eq second_project_id
        expect(record.dataset_id).to eq second_dataset_id
        expect(record.entry_id).to eq second_entry_id
        expect(record.shape_args).to eq({ x: 10, y: 20, width: 30, height: 40 })
        expect(record.category).to eq("cat")
        expect(record.created_by_email).to eq "reviewer@example.com"
      end

      it "can update" do
        update_data[:data][:id] = second_annotation_id

        record = subject.update(deserialize(update_data))

        expect(record.project_id).to eq second_project_id
        expect(record.dataset_id).to eq second_dataset_id
        expect(record.entry_id).to eq second_entry_id
        expect(record.shape_args).to eq({ x: 11, y: 21, width: 31, height: 41 })
        expect(record.category).to eq("mouse")
      end

      it "can delete" do
        subject.delete(second_annotation_id)

        record = annotation_repo.find!(second_annotation_id)

        expect(record.deleted_at).not_to be nil
        expect(record.deleted_by_email).not_to be nil
      end
    end

    describe "with assigned project and disabled project member" do
      before do
        project_member_repo.delete(reviewer_member_id) # soft delete
      end

      it "cannot index" do
        # Setup: create note feed to test visibility
        second_annotation_id # assigned

        result = subject.index({})

        expect(result.count).to eq 0
      end
    end

    describe "with assigned project and not assigned entries" do
      before do
        # Add reviewer member to third project
        project_member_repo.create(
          project_id: third_project_id,
          account_id: reviewer_account_id,
          role: "reviewer",
          email: "reviewer@example.com",
          invited_by_id: 1
        )
      end

      it "cannot index" do
        # Setup: Create annotations as "Reviewer" can see all annotations in assigned project
        first_annotation_id # not assigned
        second_annotation_id # assigned
        third_annotation_id # not assigned

        # Ensure that the reviewer is a member of the third project
        member = project_member_repo.find_by!({ account_id: reviewer_account_id, project_id: third_project_id })
        expect(member.project_id).to eq third_project_id

        # Ensure that the reviewer cannot see unassigned entries in the third project
        result = subject.index({})
        expect(result.count).to eq 1
        expect(result.first.id).to_not eq third_annotation_id
      end

      it "cannot create" do
        create_data[:data][:relationships][:entry][:data][:id] = third_entry_id

        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(
          Verse::Error::ValidationFailed,
          "entry not found to create an annotation"
        )
      end

      it "cannot update" do
        update_data[:data][:id] = third_annotation_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(third_annotation_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    describe "with not assigned project" do
      it "cannot index" do
        # Setup: Create annotations as "Reviewer" can see all annotations in assigned project
        first_annotation_id # not assigned
        second_annotation_id # assigned
        third_annotation_id # not assigned

        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.map(&:id)).to_not include first_annotation_id, third_annotation_id
      end

      it "cannot create" do
        create_data[:data][:relationships][:entry][:data][:id] = first_entry_id

        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(
          Verse::Error::ValidationFailed,
          "entry not found to create an annotation"
        )
      end

      it "cannot update" do
        update_data[:data][:id] = first_annotation_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(first_annotation_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end
  end
end
