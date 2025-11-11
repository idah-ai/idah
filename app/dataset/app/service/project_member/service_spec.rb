# frozen_string_literal: true

require "spec_helper"

RSpec.describe ProjectMember::Service, database: true do
  let(:system_context) { Verse::Auth::Context[:system] }
  let(:project_repo) { Project::Repository.new(system_context) }
  let(:project_member_repo) { ProjectMember::Repository.new(system_context) }

  # Projects
  let!(:first_project_id) {
    project_repo.create(name: "Project 1", created_by_email: "system@example.com")
  }
  let!(:second_project_id) {
    project_repo.create(name: "Project 2", created_by_email: "system@example.com")
  }

  # Project Members
  let!(:project_owner_member_id) {
    project_member_repo.create(
      project_id: first_project_id,
      account_id: 3,
      role: "project_owner",
      name: "Project Owner",
      email: "po@example.com",
      invited_by_id: 1
    )
  }
  let!(:annotator_member_id) {
    project_member_repo.create(
      project_id: first_project_id,
      account_id: 4,
      role: "annotator",
      name: "Annotator",
      email: "an@example.com",
      invited_by_id: 1
    )
  }
  let!(:reviewer_member_id) {
    project_member_repo.create(
      project_id: second_project_id,
      account_id: 5,
      role: "reviewer",
      name: "Reviewer",
      email: "re@example.com",
      invited_by_id: 1
    )
  }

  let(:update_data) do
    {
      data: {
        type: "dataset:project_members",
        id: annotator_member_id,
        attributes: {
          name: "Jane Doe",
          email: "janedoe@example.com",
          role: "reviewer",
        }
      }
    }
  end

  let(:create_data) do
    {
      data: {
        type: "dataset:project_members",
        attributes: {
          name: "John Doe",
          email: "johndoe@example.com",
          role: "annotator",
          account_id: 6,
          invited_by_id: 1
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

    describe "scoped project members" do
      it "can index" do
        result = subject.index({})

        expect(result.count).to eq 2
        expect(result.map(&:name)).to eq ["Project Owner", "Annotator"]
      end

      it "can create" do
        created = subject.create(deserialize(create_data))
        created_project_members = subject.show(created.id, included: ["project"])

        expect(created_project_members.name).to eq "John Doe"
        expect(created_project_members.project.id).to eq first_project_id
      end

      it "can update" do
        updated_project = subject.update(deserialize(update_data))

        expect(updated_project.name).to eq "Jane Doe"
        expect(updated_project.email).to eq "janedoe@example.com"
        expect(updated_project.role).to eq "reviewer"
      end

      it "can delete" do
        subject.delete(annotator_member_id)

        expect {
          subject.show(annotator_member_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    describe "not scoped project members" do
      it "cannot index" do
        result = subject.index({})

        expect(result.count).to eq 2
        expect(result.map(&:name)).to_not include "Reviewer"
      end

      it "cannot create" do
        create_data[:data][:relationships][:project][:data][:id] = second_project_id

        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(Errors::Service::UnauthorizedProjectAccess)
      end

      it "cannot update" do
        update_data[:data][:id] = reviewer_member_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(reviewer_member_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end
  end

  context "as Annotator", as: :annotator do
    subject { described_class.new(current_auth_context) }

    describe "scoped project members" do
      it "cannot index" do
        result = subject.index({})

        expect(result.count).to eq 0
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
          subject.delete(annotator_member_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    describe "not scoped project_members" do
      it "cannot index" do
        result = subject.index({})

        expect(result.count).to eq 0
      end

      it "cannot create" do
        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(Errors::Service::UnauthorizedProjectAccess)
      end

      it "cannot update" do
        update_data[:data][:id] = reviewer_member_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(reviewer_member_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end
  end

  context "as Reviewer", as: :reviewer do
    subject { described_class.new(current_auth_context) }

    describe "scoped project members" do
      it "cannot index" do
        result = subject.index({})

        expect(result.count).to eq 0
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
          subject.delete(annotator_member_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    describe "not scoped project_members" do
      it "cannot index" do
        result = subject.index({})

        expect(result.count).to eq 0
      end

      it "cannot create" do
        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(Errors::Service::UnauthorizedProjectAccess)
      end

      it "cannot update" do
        update_data[:data][:id] = annotator_member_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(annotator_member_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end
  end
end
