# frozen_string_literal: true

require "spec_helper"

RSpec.describe Project::Service, database: true do
  let(:system_context) { Verse::Auth::Context[:system] }
  let(:project_repo) { Project::Repository.new(system_context) }
  let(:project_member_repo) { ProjectMember::Repository.new(system_context) }

  # Projects
  let(:first_project_id) {
    project_repo.create(name: "Project 1", created_by_email: "system@example.com")
  }
  let(:second_project_id) {
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
      project_id: second_project_id, account_id: 4,
      role: "annotator", email: "an@example.com", invited_by_id: 1
    )
  }
  let!(:reviewer_member_id) {
    project_member_repo.create(
      project_id: second_project_id, account_id: 5,
      role: "reviewer", email: "re@example.com", invited_by_id: 1
    )
  }

  let(:update_data) do
    {
      data: {
        type: "dataset:projects",
        id: first_project_id,
        attributes: {
          name: "Updated Project",
          description: "A test project",
        }
      }
    }
  end

  let(:create_data) do
    {
      data: {
        type: "dataset:projects",
        attributes: {
          name: "Test Project",
          description: "A test project",
          created_by_email: "user@example.com"
        }
      }
    }
  end

  context "as Project Owner", as: :project_owner do
    subject { described_class.new(current_auth_context) }

    describe "scoped projects" do
      it "can index" do
        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.name).to eq "Project 1"
      end

      it "cannot create" do
        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(Verse::Error::Unauthorized)
      end

      it "can update" do
        updated_project = subject.update(deserialize(update_data))

        expect(updated_project.name).to eq "Updated Project"
      end

      it "can delete" do
        subject.delete(first_project_id)

        expect { 
          subject.show(first_project_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    describe "not scoped projects" do
      it "cannot index" do
        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.name).to_not eq "Project 2"
      end

      it "cannot create" do
        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(Verse::Error::Unauthorized)
      end

      it "cannot update" do
        update_data[:data][:id] = second_project_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(second_project_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end
  end

  context "as Annotator", as: :annotator do
    subject { described_class.new(current_auth_context) }

    describe "scoped projects" do
      it "can index" do
        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.name).to eq "Project 2"
      end

      it "cannot create" do
        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(Verse::Error::Unauthorized)
      end

      it "cannot update" do
        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(first_project_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    describe "not scoped projects" do
      it "cannot index" do
        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.name).to_not eq "Project 1"
      end

      it "cannot create" do
        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(Verse::Error::Unauthorized)
      end

      it "cannot update" do
        update_data[:data][:id] = second_project_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(second_project_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end
  end

  context "as Reviewer", as: :reviewer do
    subject { described_class.new(current_auth_context) }

    describe "scoped projects" do
      it "can index" do
        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.name).to eq "Project 2"
      end

      it "cannot create" do
        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(Verse::Error::Unauthorized)
      end

      it "cannot update" do
        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(first_project_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    describe "not scoped projects" do
      it "cannot index" do
        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.name).to_not eq "Project 1"
      end

      it "cannot create" do
        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(Verse::Error::Unauthorized)
      end

      it "cannot update" do
        update_data[:data][:id] = second_project_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(second_project_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end
  end
end
