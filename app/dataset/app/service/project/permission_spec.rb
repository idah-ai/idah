# frozen_string_literal: true

require "spec_helper"

RSpec.describe Project::Service, database: true do
  let(:system_context) { Verse::Auth::Context[:system] }
  let(:project_repo) { Project::Repository.new(system_context) }
  let(:project_member_repo) { ProjectMember::Repository.new(system_context) }

  # Projects
  let(:first_project_id) {
    project_repo.create(name: "Project 1", created_by_email: "system@example.com", organization_id: 1)
  }
  let(:second_project_id) {
    project_repo.create(name: "Project 2", created_by_email: "system@example.com", organization_id: 2)
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

  let(:update_data) do
    {
      data: {
        type: "dataset:projects",
        id: first_project_id,
        attributes: {
          name: "Updated Project",
          description: "A test project",
          organization_id: 1,
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
          created_by_email: "user@example.com",
          organization_id: 1,
        }
      }
    }
  end

  # Permission: Organization Owner
  # ------------------------------------------------
  # Projects         | index | create | update | delete
  # ------------------------------------------------
  # in owned Org     |  yes  |  yes   |   yes  |   yes
  # Not in owned Org |   x   |   x    |    x   |    x
  context "as Organization Owner", as: :org_owner do
    subject { described_class.new(current_auth_context) }
    before do
      @org_scope = current_auth_context.custom_scopes[:org]
    end

    describe "with projects in owned organization scope" do
      it "can index" do
        [first_project_id, second_project_id]

        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.map(&:organization_id)).to all(satisfy { |id| @org_scope.include?(id.to_s) })
      end

      it "can create" do
        result = subject.create(deserialize(create_data))

        expect(result.name).to eq create_data[:data][:attributes][:name]
        expect(@org_scope).to include(result.organization_id.to_s)
      end

      it "can update" do
        updated_project = subject.update(deserialize(update_data))

        expect(updated_project.name).to eq "Updated Project"
        expect(@org_scope).to include(updated_project.organization_id.to_s)
      end

      it "can delete" do
        subject.delete(first_project_id)

        expect {
          subject.show(first_project_id)
        }.to raise_error(Verse::Error::RecordNotFound)

        # the record we tried to delete should not be there anymore
        expect { project_repo.find!(first_project_id) }.to raise_error(Verse::Error::RecordNotFound)
      end
    end

    describe "with projects not in owned organization scope" do
      it "cannot index projects outside scope org scope" do
        [first_project_id, second_project_id]

        result = subject.index({})

        expect(result.map(&:organization_id)).to all(satisfy { |id| @org_scope.include?(id.to_s) })
      end

      it "cannot create project with organization_id outside org scope" do
        create_data[:data][:attributes][:organization_id] = 2
        expect {
          subject.create(deserialize(create_data))
        }.to raise_error(Verse::Error::Unauthorized)
      end

      it "cannot update project with organization_id outside org scope" do
        update_data[:data][:id] = second_project_id

        expect {
          subject.update(deserialize(update_data))
        }.to raise_error(Verse::Error::RecordNotFound)
      end

      it "cannot delete" do
        expect {
          subject.delete(second_project_id)
        }.to raise_error(Verse::Error::RecordNotFound)

        # the record we tried to delete should still be there
        expect { project_repo.find!(second_project_id) }.not_to raise_error(Verse::Error::RecordNotFound)
      end
    end
  end

  # Permission: Project Owner
  # ------------------------------------------------
  # Projects      | index | create | update | delete
  # ------------------------------------------------
  # Assigned      |  yes  |   x    |   yes  |   yes
  # Not Assigned  |   x   |   x    |    x   |    x
  context "as Project Owner", as: :project_owner do
    subject { described_class.new(current_auth_context) }

    before do
      project_owner_member_id # assigned
      annotator_member_id # not assigned
      reviewer_member_id # not assigned
    end

    describe "with assigned project" do
      it "can index" do
        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.id).to eq first_project_id
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

    describe "with assigned project and disabled project member" do
      before do
        project_member_repo.delete(project_owner_member_id) # soft delete
      end

      it "cannot index" do
        result = subject.index({})

        expect(result.count).to eq 0
      end
    end

    describe "with not assigned project" do
      it "cannot index" do
        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.id).to_not eq second_project_id
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

  # Permission: Annotator
  # ------------------------------------------------
  # Projects      | index | create | update | delete
  # ------------------------------------------------
  # Assigned      |  yes  |   x    |    x   |    x
  # Not Assigned  |   x   |   x    |    x   |    x
  context "as Annotator", as: :annotator do
    subject { described_class.new(current_auth_context) }

    before do
      project_owner_member_id # not assigned
      annotator_member_id # assigned
      reviewer_member_id # not assigned
    end

    describe "with assigned project" do
      it "can index" do
        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.id).to eq first_project_id
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

    describe "with assigned project and disabled project member" do
      before do
        project_member_repo.delete(annotator_member_id) # soft delete
      end

      it "cannot index" do
        result = subject.index({})

        expect(result.count).to eq 0
      end
    end

    describe "with not assigned project" do
      it "cannot index" do
        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.id).to_not eq second_project_id
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

  # Permission: Reviewer
  # ------------------------------------------------
  # Projects      | index | create | update | delete
  # ------------------------------------------------
  # Assigned      |  yes  |   x    |    x   |    x
  # Not Assigned  |   x   |   x    |    x   |    x
  context "as Reviewer", as: :reviewer do
    subject { described_class.new(current_auth_context) }

    before do
      project_owner_member_id # not assigned
      annotator_member_id # not assigned
      reviewer_member_id # assigned
    end

    describe "with assigned project" do
      it "can index" do
        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.id).to eq second_project_id
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

    describe "with assigned project and disabled project member" do
      before do
        project_member_repo.delete(reviewer_member_id) # soft delete
      end

      it "cannot index" do
        result = subject.index({})

        expect(result.count).to eq 0
      end
    end

    describe "with not assigned project" do
      it "cannot index" do
        result = subject.index({})

        expect(result.count).to eq 1
        expect(result.first.id).to_not eq first_project_id
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
