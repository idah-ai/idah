# frozen_string_literal: true

require "spec_helper"

RSpec.describe Dataset::Service, database: true do
  let(:system_context) { Verse::Auth::Context[:system] }
  let(:project_repo) { Project::Repository.new(system_context) }
  let(:project_member_repo) { ProjectMember::Repository.new(system_context) }
  let(:dataset_repo) { Dataset::Repository.new(system_context) }
  let(:entry_repo) { Entry::Repository.new(system_context) }

  # Projects
  let!(:first_project_id) {
    project_repo.create(name: "Project 1", created_by_email: "system@example.com")
  }
  let!(:second_project_id) {
    project_repo.create(name: "Project 2", created_by_email: "system@example.com")
  }
  let!(:third_project_id) {
    project_repo.create(name: "Project 3", created_by_email: "system@example.com")
  }

  # Accounts IDs
  let(:project_owner_account_id) { 3 }
  let(:annotator_account_id) { 4 }
  let(:reviewer_account_id) { 5 }
  let(:another_annotator_account_id) { 6 }

  # Project Members
  let!(:project_owner_member_id) {
    project_member_repo.create(
      project_id: first_project_id,
      account_id: project_owner_account_id,
      role: "project_owner",
      email: "po@example.com",
      invited_by_id: 1
    )
  }
  let!(:annotator_member_id) {
    project_member_repo.create(
      project_id: first_project_id,
      account_id: annotator_account_id,
      role: "annotator",
      email: "an@example.com",
      invited_by_id: 1
    )
  }
  let!(:reviewer_member_id) {
    project_member_repo.create(
      project_id: second_project_id,
      account_id: reviewer_account_id,
      role: "reviewer",
      email: "re@example.com",
      invited_by_id: 1
    )
  }
  let!(:another_annotator_member_id) {
    project_member_repo.create(
      project_id: third_project_id,
      account_id: another_annotator_account_id,
      role: "annotator",
      email: "an2@example.com",
      invited_by_id: 1
    )
  }

  # Datasets
  let!(:first_dataset_id) {
    dataset_repo.create(
      name: "Dataset 1",
      project_id: first_project_id,
      modality: "video",
      workflow_configuration: {},
      labeling_configuration: {}
    )
  }
  let!(:second_dataset_id) {
    dataset_repo.create(
      name: "Dataset 2",
      project_id: second_project_id,
      modality: "image",
      workflow_configuration: {},
      labeling_configuration: {}
    )
  }
  let!(:third_dataset_id) {
    dataset_repo.create(
      name: "Dataset 3",
      project_id: third_project_id,
      modality: "video",
      workflow_configuration: {},
      labeling_configuration: {}
    )
  }

  # Entries
  let!(:first_entry_id) {
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
  let!(:second_entry_id) {
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
  let!(:third_entry_id) {
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
        type: "dataset:datasets",
        id: first_dataset_id,
        attributes: {
          name: "Updated Dataset",
          modality: "image",
          labels: ["mouse", "deer"],
          labeling_configuration: { status: "updated" },
          workflow_configuration: { status: "updated" },
          project_id: first_project_id
        }
      }
    }
  end

  let(:create_data) do
    {
      data: {
        type: "dataset:datasets",
        attributes: {
          name: "Created Dataset",
          modality: "image",
          labels: ["cat", "dog"],
          labeling_configuration: { status: "created" },
          workflow_configuration: { status: "created" },
        },
        relationships: {
          project: {
            data: { type: "dataset:projects", id: first_project_id }
          }
        }
      }
    }
  end

  # Permission: Project Owner
  # ------------------------------------------------
  # Datasets      | index | create | update | delete
  # ------------------------------------------------
  # Assigned      |  yes  |  yes   |   yes  |   yes
  # Not Assigned  |   x   |   x    |    x   |    x
  context "as Project Owner", as: :project_owner do
    subject { described_class.new(current_auth_context) }

    describe "with assigned project" do
      it "can index" do
        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.id).to eq first_dataset_id
      end

      it "can create" do
        record = subject.create(deserialize(create_data))

        expect(record.project_id).to eq first_project_id
        expect(record.name).to eq "Created Dataset"
        expect(record.modality).to eq "image"
        expect(record.labels).to eq ["cat", "dog"]
        expect(record.labeling_configuration).to eq({ status: "created" })
        expect(record.workflow_configuration).to eq({ status: "created" })
      end

      it "can update" do
        record = subject.update(deserialize(update_data))

        expect(record.name).to eq "Updated Dataset"
        expect(record.modality).to eq "image"
        expect(record.labels).to eq ["mouse", "deer"]
        expect(record.labeling_configuration).to eq({ status: "updated" })
        expect(record.workflow_configuration).to eq({ status: "updated" })
      end

      it "can delete" do
        subject.delete(first_dataset_id)

        expect {
          subject.show(first_dataset_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    describe "with not assigned project" do
      it "cannot index" do
        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.id).to_not eq second_dataset_id
      end

      it "cannot create" do
        create_data[:data][:relationships][:project][:data][:id] = second_project_id

        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(Errors::Service::UnauthorizedProjectAccess)
      end

      it "cannot update" do
        update_data[:data][:id] = second_dataset_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(second_dataset_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end
  end

  # Permission: Annotator
  # ------------------------------------------------
  # Datasets      | index | create | update | delete
  # ------------------------------------------------
  # Assigned      |    yes (assigned entries only)
  # Not Assigned  |   x   |   x    |    x   |    x
  context "as Annotator", as: :annotator do
    subject { described_class.new(current_auth_context) }

    describe "with assigned project and assigned entries" do
      it "can index" do
        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.id).to eq first_dataset_id
      end

      it "cannot create" do
        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(Errors::Service::UnauthorizedProjectAccess)
      end

      it "cannot update" do
        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(first_dataset_id)
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
          email: "an@example.com",
          invited_by_id: 1
        )
      end

      it "cannot index" do
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
        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.id).to_not eq second_dataset_id
      end

      it "cannot create" do
        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(Errors::Service::UnauthorizedProjectAccess)
      end

      it "cannot update" do
        update_data[:data][:id] = second_dataset_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(second_dataset_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end
  end

  # Permission: Reviewer
  # ------------------------------------------------
  # Datasets      | index | create | update | delete
  # ------------------------------------------------
  # Assigned      |    yes (assigned entries only)
  # Not Assigned  |   x   |   x    |    x   |    x
  context "as Reviewer", as: :reviewer do
    subject { described_class.new(current_auth_context) }

    describe "with assigned project and assigned entries" do
      it "can index" do
        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.id).to eq second_dataset_id
      end

      it "cannot create" do
        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(Errors::Service::UnauthorizedProjectAccess)
      end

      it "cannot update" do
        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(first_dataset_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    describe "with not assigned project" do
      it "cannot index" do
        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.id).to_not eq first_dataset_id
      end

      it "cannot create" do
        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(Errors::Service::UnauthorizedProjectAccess)
      end

      it "cannot update" do
        update_data[:data][:id] = second_dataset_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(second_dataset_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end
  end
end
