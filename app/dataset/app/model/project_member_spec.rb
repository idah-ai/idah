# frozen_string_literal: true

require "spec_helper"

RSpec.describe ProjectMember, database: true do
  describe ProjectMember::Repository do
    system_context = Verse::Auth::Context[:system]
    system_repo = described_class.new(system_context)
    project_repo = Project::Repository.new(system_context)

    let!(:test_project1) {
      project_repo.find!(
        project_repo.create(
          name: "testing_project_1",
        )
      )
    }

    let!(:membership1) {
      system_repo.find!(
        system_repo.create(
          project_id: test_project1.id,
          account_id: 1,
          name: "first user",
          email: "first@email.com",
          permission_set: "owner",
        )
      )
    }

    let!(:test_project2) {
      project_repo.find!(
        project_repo.create(
          name: "testing_project_2",
        )
      )
    }

    let!(:membership2) {
      system_repo.find!(
        system_repo.create(
          project_id: test_project2.id,
          account_id: 1,
          name: "first user",
          email: "first@email.com",
          permission_set: "owner",
        )
      )
    }

    let!(:membership3) {
      system_repo.find!(
        system_repo.create(
          project_id: test_project2.id,
          account_id: 2,
          name: "second user",
          email: "second@email.com",
          permission_set: "owner",
        )
      )
    }

    describe "scope definitions" do
      context "scope: all", as: :admin do
        subject { described_class.new(current_auth_context) }

        it "returns all project members" do
          project_members = subject.index({})

          expect(project_members.size).to eq(3)
        end
      end

      context "scope: as_user", as: :user do
        subject { described_class.new(current_auth_context) }

        it "returns user-scoped members" do
          project_members = subject.index({})

          expect(project_members.size).to eq(2)

          # self membership and members in same projects
          account_id = current_auth_context.metadata[:id]
          project_members.each do |project_member|
            expect(project_member.project_id == test_project2.id || project_member.account_id == account_id)
              .to be_truthy
          end
        end
      end
    end

    describe "authorize_action", as: :user do
      context "with admin account", as: :admin do
        subject { described_class.new(current_auth_context) }

        it "allows any action" do
          expect {
            subject.authorize_action(
              action: :read,
              resource: Resource::Dataset::ProjectMembers,
              account_id: current_auth_context.metadata[:id],
              project_id: test_project1,
              allowed_permission_sets: []
            )
          }.not_to raise_error
        end
      end

      # context "with user accouint", as: :admin do
    end
  end
end
