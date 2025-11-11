# frozen_string_literal: true

require "spec_helper"

RSpec.describe Dataset::Service, database: true do
  let(:system_context) { Verse::Auth::Context[:system] }
  let(:project_repo) { Project::Repository.new(system_context) }
  let(:project_member_repo) { ProjectMember::Repository.new(system_context) }
  let(:dataset_repo) { Dataset::Repository.new(system_context) }

  # Projects
  let!(:first_project_id) {
    project_repo.create(name: "Project 1", created_by_email: "system@example.com")
  }
  let!(:second_project_id) {
    project_repo.create(name: "Project 2", created_by_email: "system@example.com")
  }

  # Project Members
  let!(:owner_member_id) {
    project_member_repo.create(
      project_id: first_project_id, account_id: 3,
      role: "project_owner", email: "po@example.com", invited_by_id: 1
    )
  }
  let!(:annotator_member_id) {
    project_member_repo.create(
      project_id: first_project_id, account_id: 4,
      role: "annotator", email: "an@example.com", invited_by_id: 1
    )
  }
  let!(:reviewer_member_id) {
    project_member_repo.create(
      project_id: second_project_id, account_id: 5,
      role: "reviewer", email: "re@example.com", invited_by_id: 1
    )
  }

  # Datasets
  let!(:first_dataset_id) {
    dataset_repo.create(
      name: "Dataset 1", project_id: first_project_id,
      modality: "video", workflow_configuration: {}, labeling_configuration: {}
    )
  }
  let!(:second_dataset_id) {
    dataset_repo.create(
      name: "Dataset 2", project_id: second_project_id,
      modality: "image", workflow_configuration: {}, labeling_configuration: {}
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
          labels: ["cat", "dog"],
          labeling_configuration: {},
          workflow_configuration: {},
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
          labeling_configuration: {},
          workflow_configuration: {},
        },
        relationships: {
          project: {
            data: { type: "dataset:projects", id: first_project_id }
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
        expect(result.first.name).to eq "Dataset 1"
      end

      it "can create" do
        created = subject.create(deserialize(create_data))
        created_dataset = subject.show(created.id, included: ["project"])

        expect(created_dataset.name).to eq "Created Dataset"
        expect(created_dataset.project.id).to eq first_project_id
      end

      it "can update" do
        updated_project = subject.update(deserialize(update_data))

        expect(updated_project.name).to eq "Updated Dataset"
      end

      it "can delete" do
        subject.delete(first_dataset_id)

        expect { 
          subject.show(first_dataset_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    describe "not scoped datasets" do
      it "cannot index" do
        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.name).to_not eq "Dataset 2"
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

  context "as Annotator", as: :annotator do
    subject { described_class.new(current_auth_context) }

    describe "scoped datasets" do
      it "can index" do
        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.name).to eq "Dataset 1"
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

    describe "not scoped datasets" do
      it "cannot index" do
        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.name).to_not eq "Dataset 2"
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

  context "as Reviewer", as: :reviewer do
    subject { described_class.new(current_auth_context) }

    describe "scoped datasets" do
      it "can index" do
        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.name).to eq "Dataset 2"
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

    describe "not scoped datasets" do
      it "cannot index" do
        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.name).to_not eq "Dataset 1"
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
