# frozen_string_literal: true

require "spec_helper"

RSpec.describe Entry::Service, database: true do
  let(:system_context) { Verse::Auth::Context[:system] }
  let(:project_repo) { Project::Repository.new(system_context) }
  let(:project_member_repo) { ProjectMember::Repository.new(system_context) }
  let(:dataset_repo) { Dataset::Repository.new(system_context) }
  let(:entry_repo) { Entry::Repository.new(system_context) }

  # Projects
  let!(:first_project_id) {
    project_repo.create(name: "Project 1", created_by_email: "system@example.com", organization_id: 1)
  }
  let!(:second_project_id) {
    project_repo.create(name: "Project 2", created_by_email: "system@example.com", organization_id: 1)
  }
  let(:third_project_id) {
    project_repo.create(name: "Project 3", created_by_email: "system@example.com", organization_id: 1)
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
      email: "annotator@example.com",
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
      assigned_to_id: annotator_account_id,
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
      assigned_to_id: reviewer_account_id,
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

  let(:update_data) do
    {
      data: {
        type: "dataset:entries",
        id: first_entry_id,
        attributes: {
          priority: 2,
          resource: "http://example.com/updated.mp4",
          wf_step: "end",
          status: "done",
          assigned_to_id: annotator_account_id,
        }
      }
    }
  end

  let(:create_data) do
    {
      data: {
        type: "dataset:entries",
        attributes: {
          priority: 1,
          resource: "http://example.com/created.mp4",
          wf_step: "start",
          status: "pending",
        },
        relationships: {
          dataset: {
            data: { type: "dataset:datasets", id: first_dataset_id }
          }
        }
      }
    }
  end

  # Permission: Project Owner
  # ------------------------------------------------
  # Entries       | index | create | update | delete
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
        # Setup: Create entries as "Project Owner" can see all entries in assigned project
        [first_entry_id, second_entry_id, third_entry_id]

        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.id).to eq first_entry_id
      end

      it "can create" do
        record = subject.create(deserialize(create_data))

        expect(record.project_id).to eq first_project_id
        expect(record.dataset_id).to eq first_dataset_id
        expect(record.resource).to eq "http://example.com/created.mp4"
        expect(record.status).to eq "pending"
        expect(record.wf_step).to eq "start"
        expect(record.priority).to eq 1
        expect(record.assigned_to_id).to be_nil
      end

      it "can update" do
        record = subject.update(deserialize(update_data))

        expect(record.priority).to eq 2
        expect(record.resource).to eq "http://example.com/updated.mp4"
        expect(record.wf_step).to eq "end"
        expect(record.status).to eq "done"
        expect(record.assigned_to_id).to eq 4
      end

      it "can delete" do
        subject.delete(first_entry_id)

        expect {
          subject.show(first_entry_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    describe "with not assigned project" do
      it "cannot index" do
        # Setup: Create entries as "Project Owner" can see all entries in assigned project
        [first_entry_id, second_entry_id, third_entry_id]

        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.id).to_not include second_entry_id, third_entry_id
      end

      it "cannot create" do
        create_data[:data][:relationships][:dataset][:data][:id] = second_dataset_id

        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(Verse::Error::ValidationFailed, "dataset not found to create an entry")
      end

      it "cannot create as annotator of another project" do
        # Add "project_owner" member to second project as "annotator"
        project_member_repo.create(
          project_id: second_project_id,
          account_id: project_owner_account_id,
          role: "annotator",
          email: "project_owner@example.com",
          invited_by_id: 1
        )

        # Create another entry in second dataset to be able to access it
        entry_repo.create(
          project_id: second_project_id,
          dataset_id: second_dataset_id,
          priority: 1,
          resource: "http://example.com/second.mp4",
          wf_step: "start",
          status: "pending",
          assigned_to_id: project_owner_account_id,
        )

        create_data[:data][:relationships][:dataset][:data][:id] = second_dataset_id

        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(
          Verse::Error::Unauthorized,
          "You do not have permission to create entry on this project"
        )
      end

      it "cannot update" do
        update_data[:data][:id] = second_entry_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(second_entry_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end
  end

  # Permission: Annotator
  # ------------------------------------------------
  # Entries       | index | create | update | delete
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
        # Setup: Create entries as "Annotator" can see all entries in assigned entries
        [first_entry_id, second_entry_id, third_entry_id]

        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.id).to eq first_entry_id
      end

      it "cannot create" do
        # Create dataset and entry in first project to be able to access it
        [first_dataset_id, first_entry_id]

        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(
          Verse::Error::Unauthorized,
          "You do not have permission to create entry on this project"
        )
      end

      it "cannot update" do
        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(first_entry_id)
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
        # Setup: Create entries as "Annotator" can see all entries in assigned entries
        [first_entry_id, second_entry_id, third_entry_id]

        # Ensure that the annotator is a member of the third project
        member = project_member_repo.find_by!({ account_id: annotator_account_id, project_id: third_project_id })
        expect(member.project_id).to eq third_project_id

        # Ensure that the annotator cannot see unassigned entries in the third project
        result = subject.index({})
        expect(result.count).to eq 1
        expect(result.first.id).to_not eq third_entry_id
      end
    end

    describe "with not assigned project" do
      it "cannot index" do
        # Setup: Create entries as "Annotator" can see all entries in assigned entries
        [first_entry_id, second_entry_id, third_entry_id]

        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.id).to_not include second_entry_id, third_entry_id
      end

      it "cannot create" do
        create_data[:data][:relationships][:dataset][:data][:id] = second_dataset_id

        # User cannot access dataset in unassigned project
        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(
          Verse::Error::ValidationFailed,
          "dataset not found to create an entry"
        )
      end

      it "cannot update" do
        update_data[:data][:id] = second_entry_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(second_entry_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end
  end

  # Permission: Reviewer
  # ------------------------------------------------
  # Entries       | index | create | update | delete
  # ------------------------------------------------
  # Assigned      |  yes (from assigned entries only)
  # Not Assigned  |   x   |   x    |    x   |    x
  context "as Reviewer", as: :reviewer do
    subject { described_class.new(current_auth_context) }

    before do
      reviewer_member_id # Assign user to project
    end

    describe "with assigned project on assigned entries" do
      it "can index" do
        # Setup: Create entries as "Reviewer" can see all entries in assigned entries
        [first_entry_id, second_entry_id, third_entry_id]

        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.id).to eq second_entry_id
      end

      it "cannot create" do
        # Create dataset and entry in first project to be able to access it
        [second_dataset_id, second_entry_id]

        create_data[:data][:relationships][:dataset][:data][:id] = second_dataset_id

        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(
          Verse::Error::Unauthorized,
          "You do not have permission to create entry on this project"
        )
      end

      it "cannot update" do
        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(first_entry_id)
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
        # Setup: Create entries as "Reviewer" can see all entries in assigned entries
        [first_entry_id, second_entry_id, third_entry_id]

        # Ensure that the reviewer is a member of the third project
        member = project_member_repo.find_by!({ account_id: reviewer_account_id, project_id: third_project_id })
        expect(member.project_id).to eq third_project_id

        # Ensure that the reviewer cannot see unassigned entries in the third project
        result = subject.index({})
        expect(result.count).to eq 1
        expect(result.first.id).to_not eq third_entry_id
      end
    end

    describe "with not assigned project" do
      it "cannot index" do
        # Setup: Create entries as "Annotator" can see all entries in assigned entries
        [first_entry_id, second_entry_id, third_entry_id]

        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.id).to_not include first_entry_id, third_entry_id
      end

      it "cannot create" do
        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(
          Verse::Error::ValidationFailed,
          "dataset not found to create an entry"
        )
      end

      it "cannot update" do
        update_data[:data][:id] = second_entry_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(second_entry_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end
  end
end
