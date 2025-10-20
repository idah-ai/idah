# frozen_string_literal: true

require "spec_helper"

RSpec.describe ProjectMember::Service, database: true do
  let(:auth_context){ Verse::Auth::Context.new }

  subject { described_class.new(auth_context) }

  let(:project_repo) { Project::Repository.new(auth_context) }
  let(:project_member_repo) { ProjectMember::Repository.new(auth_context) }

  let!(:project_id) do
    project_repo.create(name: "Test Project", description: "A test project", created_by_id: 1)
  end

  let(:attributes) do
    {
      project_id: project_id,
      account_id: 1,
      email: "annotator@email.com",
      permission_set: "annotator",
      invited_by_id: 1
    }
  end

  describe "#create" do
    it "creates a new project member" do
      record = deserialize(
        {
          data: {
            type: "dataset:project_members",
            attributes: attributes,
            relationships: {
              project: {
                data: {
                  type: "dataset:projects",
                  id: project_id
                }
              }
            }
          }
        }
      )

      project_member = subject.create(record)
      expect(project_member.project_id).to eq(project_id)
      expect(project_member.account_id).to eq(1)
      expect(project_member.email).to eq("annotator@email.com")
      expect(project_member.permission_set).to eq("annotator")
    end
  end

  describe "#show" do
    it "shows a project member" do
      project_member_id = project_member_repo.create(attributes)

      found_project_member = subject.show(project_member_id)
      expect(found_project_member.id.to_s).to eq(project_member_id)
    end
  end

  describe "#update" do
    it "updates a project member" do
      project_member_id = project_member_repo.create(attributes)

      record = deserialize(
        {
          data: {
            type: "dataset:project_members",
            id: project_member_id,
            attributes: {
              permission_set: "owner"
            }
          }
        }
      )

      subject.update(record)

      updated_project_member = project_member_repo.find!(project_member_id)
      expect(updated_project_member.permission_set).to eq("owner")
    end
  end

  describe "#delete" do
    it "deletes a project member" do
      project_member_id = project_member_repo.create(attributes)
      subject.delete(project_member_id)
      expect { project_member_repo.find!(project_member_id) }.to raise_error(Verse::Error::NotFound)
    end
  end
end
