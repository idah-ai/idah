# frozen_string_literal: true

require "spec_helper"

RSpec.describe ProjectMember::Service, database: true do
  let(:auth_context){ Verse::Auth::Context.new }

  subject { described_class.new(auth_context) }

  let(:project_repo) { Project::Repository.new(auth_context) }
  let(:project_member_repo) { ProjectMember::Repository.new(auth_context) }

  let!(:project_id) do
    project_repo.create(
      name: "Test Project",
      description: "A test project",
      created_by_email: "user@example.com",
      organization_id: 1
    )
  end

  let(:attributes) do
    {
      project_id: project_id,
      account_id: 1,
      email: "annotator@email.com",
      role: "annotator",
      invited_by_id: 1
    }
  end

  describe "#index" do
    it "returns all project members" do
      project_member_repo.create(attributes)
      project_member_repo.create(attributes.merge(email: "annotator2@email.com", account_id: 2))

      result = subject.index
      expect(result.count).to eq(2)
    end

    it "filters project members by project_id" do
      project_member_repo.create(attributes)

      another_project_id = project_repo.create(
        name: "Another Project",
        description: "Another test project",
        created_by_email: "user2@example.com",
        organization_id: 1
      )
      project_member_repo.create(attributes.merge(project_id: another_project_id, email: "annotator2@email.com"))

      result = subject.index({ project_id: project_id })
      expect(result.count).to eq(1)
      expect(result.first.project_id).to eq(project_id)
    end
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
      expect(project_member.role).to eq("annotator")
    end

    context "notifications" do
      before do
        expect_any_instance_of(ProjectMember::Repository).to receive(:after_commit).and_yield
        allow(Api[:idah].iam.accounts).to receive(:show).and_return(
          double(email: "inviter@example.com", joined_at: Time.now)
        )
        allow(Service::Notification).to receive(:email)
      end

      it "sends notification email when account has joined" do
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

        subject.create(record)

        expect(Service::Notification).to have_received(:email).with(
          hash_including(
            recipient_account_email: "annotator@email.com",
            title: "You have been assigned to the project 'Test Project'",
            category: "project_member_added",
            project_name: "Test Project"
          )
        )
      end

      it "does not send notification email when account has not joined" do
        allow(Api[:idah].iam.accounts).to receive(:show).and_return(
          double(email: "inviter@example.com", joined_at: nil)
        )

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

        subject.create(record)

        expect(Service::Notification).not_to have_received(:email)
      end
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
              role: "admin"
            }
          }
        }
      )

      subject.update(record)

      updated_project_member = project_member_repo.find!(project_member_id)
      expect(updated_project_member.role).to eq("admin")
    end
  end

  describe "#delete" do
    it "deletes a project member" do
      project_member_id = project_member_repo.create(attributes)
      subject.delete(project_member_id)
      expect { project_member_repo.find!(project_member_id) }.to raise_error(Verse::Error::NotFound)
    end

    context "notifications" do
      before do
        expect_any_instance_of(ProjectMember::Repository).to receive(:after_commit).and_yield
        allow(Service::Notification).to receive(:email)
      end

      it "sends notification email when project member is deleted" do
        project_member_id = project_member_repo.create(attributes)

        subject.delete(project_member_id)

        expect(Service::Notification).to have_received(:email).with(
          hash_including(
            recipient_account_email: "annotator@email.com",
            title: "You have been removed from the project 'Test Project'",
            category: "project_member_removed",
            project_name: "Test Project"
          )
        )
      end
    end
  end
end
