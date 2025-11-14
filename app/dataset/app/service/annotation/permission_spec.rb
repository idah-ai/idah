# frozen_string_literal: true

require "spec_helper"

RSpec.describe Annotation::Service, database: true do
  let(:system_context) { Verse::Auth::Context[:system] }
  let(:project_repo) { Project::Repository.new(system_context) }
  let(:project_member_repo) { ProjectMember::Repository.new(system_context) }
  let(:dataset_repo) { Dataset::Repository.new(system_context) }
  let(:entry_repo) { Entry::Repository.new(system_context) }
  let(:annotation_repo) { Annotation::Repository.new(system_context) }

  # Projects
  let(:first_project_id) {
    project_repo.create(name: "Project 1", created_by_email: "system@example.com")
  }
  let(:second_project_id) {
    project_repo.create(name: "Project 2", created_by_email: "system@example.com")
  }
  let(:third_project_id) {
    project_repo.create(name: "Project 3", created_by_email: "system@example.com")
  }

  # Accounts IDs
  let(:project_owner_account_id) { 3 }
  let(:annotator_account_id) { 4 }
  let(:reviewer_account_id) { 5 }
  let(:another_annotator_account_id) { 6 }

  # Project Members
  let(:project_owner_member_id) {
    project_member_repo.create(
      project_id: first_project_id,
      account_id: project_owner_account_id,
      role: "project_owner",
      email: "project_owner@example.com",
      invited_by_id: 1
    )
  }
  let(:annotator_member_id) {
    project_member_repo.create(
      project_id: first_project_id,
      account_id: annotator_account_id,
      role: "annotator",
      email: "reviewer@example.com",
      invited_by_id: 1
    )
  }
  let(:reviewer_member_id) {
    project_member_repo.create(
      project_id: second_project_id,
      account_id: reviewer_account_id,
      role: "reviewer",
      email: "reviewer@example.com",
      invited_by_id: 1
    )
  }
  let(:another_annotator_member_id) {
    project_member_repo.create(
      project_id: third_project_id,
      account_id: another_annotator_account_id,
      role: "annotator",
      email: "annotator2@example.com",
      invited_by_id: 1
    )
  }

  # Datasets
  let(:first_dataset_id) {
    dataset_repo.create(
      name: "Dataset 1",
      project_id: first_project_id,
      modality: "video",
      workflow_configuration: {},
      labeling_configuration: {}
    )
  }
  let(:second_dataset_id) {
    dataset_repo.create(
      name: "Dataset 2",
      project_id: second_project_id,
      modality: "image",
      workflow_configuration: {},
      labeling_configuration: {}
    )
  }
  let(:third_dataset_id) {
    dataset_repo.create(
      name: "Dataset 3",
      project_id: third_project_id,
      modality: "video",
      workflow_configuration: {},
      labeling_configuration: {}
    )
  }

  # Entries
  let(:first_entry_id) {
    entry_repo.create(
      project_id: first_project_id,
      dataset_id: first_dataset_id,
      priority: 1,
      resource: "http://example.com/first.mp4",
      wf_step: "start",
      status: "pending",
      assigned_to_id: 4, # annotator
    )
  }
  let(:second_entry_id) {
    entry_repo.create(
      project_id: second_project_id,
      dataset_id: second_dataset_id,
      priority: 1,
      resource: "http://example.com/second.mp4",
      wf_step: "start",
      status: "pending",
      assigned_to_id: 5, # reviewer
    )
  }
  let(:third_entry_id) {
    entry_repo.create(
      project_id: third_project_id,
      dataset_id: third_dataset_id,
      priority: 1,
      resource: "http://example.com/second.mp4",
      wf_step: "start",
      status: "pending",
      assigned_to_id: another_annotator_account_id,
    )
  }

  # Annotations
  let(:first_annotation_id) {
    annotation_repo.create(
      project_id: first_project_id,
      dataset_id: first_dataset_id,
      entry_id: first_entry_id,
      dimensions: { x: 10, y: 20, width: 30, height: 40 },
      annotation: { label: "cat" },
      created_by_email: "reviewer@example.com"
    )
  }
  let(:second_annotation_id) {
    annotation_repo.create(
      project_id: second_project_id,
      dataset_id: second_dataset_id,
      entry_id: second_entry_id,
      dimensions: { x: 50, y: 60, width: 70, height: 80 },
      annotation: { label: "dog" },
      created_by_email: "reviewer@example.com"
    )
  }
  let(:third_annotation_id) {
    annotation_repo.create(
      project_id: third_project_id,
      dataset_id: third_dataset_id,
      entry_id: third_entry_id,
      dimensions: { x: 90, y: 100, width: 110, height: 120 },
      annotation: { label: "mouse" },
      created_by_email: "annnotator2@example.com"
    )
  }

  let(:update_data) do
    {
      data: {
        type: "dataset:annotations",
        id: first_annotation_id,
        attributes: {
          dimensions: { x: 11, y: 21, width: 31, height: 41 },
          annotation: { label: "mouse" },
        }
      }
    }
  end

  let(:create_data) do
    {
      data: {
        type: "dataset:annotations",
        attributes: {
          dimensions: { x: 10, y: 20, width: 30, height: 40 },
          annotation: { label: "cat" },
          created_by_email: "annotator@example.com"
        },
        relationships: {
          entry: {
            data: {
              type: "dataset:entries",
              id: first_entry_id
            }
          }
        }
      }
    }
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
        [first_annotation_id, second_annotation_id, third_annotation_id]

        result = subject.index({})

        expect(result.count).to eq 1

        record = result.first
        expect(record.id).to eq first_annotation_id
      end

      it "can create" do
        record = subject.create(deserialize(create_data))

        expect(record.project_id).to eq first_project_id
        expect(record.dataset_id).to eq first_dataset_id
        expect(record.entry_id).to eq first_entry_id
        expect(record.dimensions).to eq({ x: 10, y: 20, width: 30, height: 40 })
        expect(record.annotation).to eq({ label: "cat" })
        expect(record.created_by_email).to eq "project_owner@example.com"
      end

      it "can update" do
        record = subject.update(deserialize(update_data))

        expect(record.project_id).to eq first_project_id
        expect(record.dataset_id).to eq first_dataset_id
        expect(record.entry_id).to eq first_entry_id
        expect(record.dimensions).to eq({ x: 11, y: 21, width: 31, height: 41 })
        expect(record.annotation).to eq({ label: "mouse" })
      end

      it "can delete" do
        subject.delete(first_annotation_id)

        expect {
          subject.show(first_annotation_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    describe "with not assigned project" do
      it "cannot index" do
        # Setup: Create annotations as "Project Owner" can see all annotations in assigned project
        [first_annotation_id, second_annotation_id, third_annotation_id]

        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.id).to_not include second_annotation_id, third_annotation_id
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
        [first_annotation_id, second_annotation_id, third_annotation_id]

        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.id).to eq first_annotation_id
      end

      it "can create" do
        record = subject.create(deserialize(create_data))

        expect(record.project_id).to eq first_project_id
        expect(record.dataset_id).to eq first_dataset_id
        expect(record.entry_id).to eq first_entry_id
        expect(record.dimensions).to eq({ x: 10, y: 20, width: 30, height: 40 })
        expect(record.annotation).to eq({ label: "cat" })
        expect(record.created_by_email).to eq "annotator@example.com"
      end

      it "can update" do
        record = subject.update(deserialize(update_data))

        expect(record.project_id).to eq first_project_id
        expect(record.dataset_id).to eq first_dataset_id
        expect(record.entry_id).to eq first_entry_id
        expect(record.dimensions).to eq({ x: 11, y: 21, width: 31, height: 41 })
        expect(record.annotation).to eq({ label: "mouse" })
      end

      it "can delete" do
        subject.delete(first_annotation_id)

        expect {
          subject.show(first_annotation_id)
        }.to raise_error(Verse::Error::RecordNotFound)
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
        [first_annotation_id, second_annotation_id, third_annotation_id]

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
        [first_annotation_id, second_annotation_id, third_annotation_id]

        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.id).to_not include second_annotation_id, third_annotation_id
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
        [first_annotation_id, second_annotation_id, third_annotation_id]

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
        expect(record.dimensions).to eq({ x: 10, y: 20, width: 30, height: 40 })
        expect(record.annotation).to eq({ label: "cat" })
        expect(record.created_by_email).to eq "reviewer@example.com"
      end

      it "can update" do
        update_data[:data][:id] = second_annotation_id

        record = subject.update(deserialize(update_data))

        expect(record.project_id).to eq second_project_id
        expect(record.dataset_id).to eq second_dataset_id
        expect(record.entry_id).to eq second_entry_id
        expect(record.dimensions).to eq({ x: 11, y: 21, width: 31, height: 41 })
        expect(record.annotation).to eq({ label: "mouse" })
      end

      it "can delete" do
        subject.delete(second_annotation_id)

        expect {
          subject.show(second_annotation_id)
        }.to raise_error(Verse::Error::RecordNotFound)
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
        [first_annotation_id, second_annotation_id, third_annotation_id]

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
        [first_annotation_id, second_annotation_id, third_annotation_id]

        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.id).to_not include first_annotation_id, third_annotation_id
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
