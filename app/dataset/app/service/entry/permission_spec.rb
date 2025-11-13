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

  # Project Members
  let!(:project_owner_member_id) {
    project_member_repo.create(
      project_id: first_project_id,
      account_id: 3,
      role: "project_owner",
      email: "po@example.com",
      invited_by_id: 1
    )
  }
  let!(:annotator_member_id) {
    project_member_repo.create(
      project_id: first_project_id,
      account_id: 4,
      role: "annotator",
      email: "an@example.com",
      invited_by_id: 1
    )
  }
  let!(:reviewer_member_id) {
    project_member_repo.create(
      project_id: second_project_id,
      account_id: 5,
      role: "reviewer",
      email: "re@example.com",
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

  # Entries
  let!(:first_entry_id) {
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
  let!(:second_entry_id) {
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
          assigned_to_id: 4
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

  context "as Project Owner", as: :project_owner do
    subject { described_class.new(current_auth_context) }

    describe "scoped datasets" do
      it "can index" do
        result = subject.index({})

        expect(result.count).to eq 1

        first_entry = result.first
        expect(first_entry.project_id).to eq first_project_id
        expect(first_entry.dataset_id).to eq first_dataset_id
        expect(first_entry.resource).to eq "http://example.com/first.mp4"
        expect(first_entry.status).to eq "pending"
        expect(first_entry.wf_step).to eq "start"
        expect(first_entry.priority).to eq 1
        expect(first_entry.assigned_to_id).to eq 4
      end

      it "can create" do
        created = subject.create(deserialize(create_data))
        created_entry = subject.show(created.id, included: ["project"])

        expect(created_entry.project_id).to eq first_project_id
        expect(created_entry.dataset_id).to eq first_dataset_id
        expect(created_entry.resource).to eq "http://example.com/created.mp4"
        expect(created_entry.status).to eq "pending"
        expect(created_entry.wf_step).to eq "start"
        expect(created_entry.priority).to eq 1
        expect(created_entry.assigned_to_id).to be_nil
      end

      it "can update" do
        updated_project = subject.update(deserialize(update_data))

        expect(updated_project.priority).to eq 2
        expect(updated_project.resource).to eq "http://example.com/updated.mp4"
        expect(updated_project.wf_step).to eq "end"
        expect(updated_project.status).to eq "done"
        expect(updated_project.assigned_to_id).to eq 4
      end

      it "can delete" do
        subject.delete(first_entry_id)

        expect {
          subject.show(first_entry_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    describe "not scoped datasets" do
      it "cannot index" do
        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.resource).to_not eq "http://example.com/second.mp4"
      end

      it "cannot create" do
        create_data[:data][:relationships][:dataset][:data][:id] = second_dataset_id

        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(Verse::Error::ValidationFailed, "dataset not found to create an entry")
      end

      it "cannot create with multiple project members" do
        # Add "project_owner" member to second project as "annotator"
        project_member_repo.create(
          project_id: second_project_id,
          account_id: 3,
          role: "annotator",
          email: "po@example.com",
          invited_by_id: 1
        )

        create_data[:data][:relationships][:dataset][:data][:id] = second_dataset_id

        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(Errors::Service::UnauthorizedProjectAccess)
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

  context "as Annotator", as: :annotator do
    subject { described_class.new(current_auth_context) }

    describe "scoped entries" do
      it "can index" do
        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.resource).to eq "http://example.com/first.mp4"
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
          subject.delete(first_entry_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    describe "not scoped entries" do
      it "cannot index" do
        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.resource).to_not eq "http://example.com/second.mp4"
      end

      it "cannot create" do
        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(Errors::Service::UnauthorizedProjectAccess)
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

  context "as Reviewer", as: :reviewer do
    subject { described_class.new(current_auth_context) }

    describe "scoped entries" do
      it "can index" do
        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.resource).to eq "http://example.com/second.mp4"
      end

      it "cannot create" do
        create_data[:data][:relationships][:dataset][:data][:id] = second_dataset_id

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
          subject.delete(first_entry_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    describe "not scoped entries" do
      it "cannot index" do
        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.resource).to_not eq "http://example.com/first.mp4"
      end

      it "cannot create" do
        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(Verse::Error::ValidationFailed, "dataset not found to create an entry")
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
