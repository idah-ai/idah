# frozen_string_literal: true

require "spec_helper"

RSpec.describe ProjectMember::Service, database: true do
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

  # Accounts IDs
  let(:project_owner_account_id) { 3 }
  let(:annotator_account_id) { 4 }
  let(:reviewer_account_id) { 5 }

  # Project Members
  let(:project_owner_member_id) {
    project_member_repo.create(
      project_id: first_project_id,
      account_id: project_owner_account_id,
      role: "project_owner",
      name: "Project Owner",
      email: "po@example.com",
      invited_by_id: 1
    )
  }
  let(:annotator_member_id) {
    project_member_repo.create(
      project_id: first_project_id,
      account_id: annotator_account_id,
      role: "annotator",
      name: "Annotator",
      email: "an@example.com",
      invited_by_id: 1
    )
  }
  let(:reviewer_member_id) {
    project_member_repo.create(
      project_id: second_project_id,
      account_id: reviewer_account_id,
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
          account_id: annotator_account_id,
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

  # Permission: Project Owner
  # ---------------------------------------------------
  # Project Members | index | create | update | delete
  # ---------------------------------------------------
  # Assigned        |  yes  |  yes   |   yes  |   yes
  # Not Assigned    |   x   |   x    |    x   |    x
  context "as Project Owner", as: :project_owner do
    subject { described_class.new(current_auth_context) }

    before do
      project_owner_member_id # Assign user to project
    end

    describe "with assigned project" do
      it "can index" do
        # Setup: create other project members to test visibility
        [annotator_member_id, reviewer_member_id]

        result = subject.index({})

        expect(result.count).to eq 2
        expect(result.map(&:name)).to eq ["Project Owner", "Annotator"]
      end

      it "can create" do
        record = subject.create(deserialize(create_data))

        expect(record.name).to eq "John Doe"
        expect(record.email).to eq "johndoe@example.com"
        expect(record.account_id).to eq annotator_account_id
        expect(record.project_id).to eq first_project_id
      end

      it "can update" do
        record = subject.update(deserialize(update_data))

        expect(record.name).to eq "Jane Doe"
        expect(record.email).to eq "janedoe@example.com"
        expect(record.role).to eq "reviewer"
      end

      it "can delete" do
        subject.delete(annotator_member_id)

        expect {
          subject.show(annotator_member_id)
        }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    describe "with not assigned project" do
      it "cannot index" do
        # Setup: create other project members to test visibility
        [annotator_member_id, reviewer_member_id]

        result = subject.index({})

        expect(result.count).to eq 2
        expect(result.map(&:name)).to_not include "Reviewer"
      end

      it "cannot create" do
        create_data[:data][:relationships][:project][:data][:id] = second_project_id

        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(
          Verse::Error::Unauthorized,
          "You do not have permission to create project member on this project"
        )
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

  # Permission: Annotator
  # ---------------------------------------------------
  # Project Members | index | create | update | delete
  # ---------------------------------------------------
  # Assigned        |  yes  |   x    |    x   |    x
  # Not Assigned    |   x   |   x    |    x   |    x
  context "as Annotator", as: :annotator do
    subject { described_class.new(current_auth_context) }

    before do
      annotator_member_id # Assign user to project
    end

    describe "with assigned project" do
      it "can index" do
        # Setup: create other project members to test visibility
        [project_owner_member_id, reviewer_member_id]

        result = subject.index({})

        expect(result.count).to eq 2
        expect(result.map(&:name).sort).to eq ["Annotator", "Project Owner"]
      end

      it "cannot create" do
        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(
          Verse::Error::Unauthorized,
          "You do not have permission to create project member on this project"
        )
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

    describe "with not assigned project" do
      it "cannot index" do
        # Setup: create other project members to test visibility
        [project_owner_member_id, reviewer_member_id]

        result = subject.index({})

        expect(result.count).to eq 2
        expect(result.map(&:name)).to_not include "Reviewer"
      end

      it "cannot create" do
        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(
          Verse::Error::Unauthorized,
          "You do not have permission to create project member on this project"
        )
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

  # Permission: Reviewer
  # ---------------------------------------------------
  # Project Members | index | create | update | delete
  # ---------------------------------------------------
  # Assigned        |  yes  |   x    |    x   |    x
  # Not Assigned    |   x   |   x    |    x   |    x
  context "as Reviewer", as: :reviewer do
    subject { described_class.new(current_auth_context) }

    before do
      reviewer_member_id # Assign user to project
    end

    describe "with assigned project" do
      it "can index" do
        # Setup: create other project members to test visibility
        [project_owner_member_id, annotator_member_id]

        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.map(&:name)).to eq ["Reviewer"]
      end

      it "cannot create" do
        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(
          Verse::Error::Unauthorized,
          "You do not have permission to create project member on this project"
        )
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

    describe "with not assigned project" do
      it "cannot index" do
        # Setup: create other project members from different project
        [project_owner_member_id, annotator_member_id]

        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.map(&:name)).to_not include "Project Owner", "Annotator"
      end

      it "cannot create" do
        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(
          Verse::Error::Unauthorized,
          "You do not have permission to create project member on this project"
        )
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
