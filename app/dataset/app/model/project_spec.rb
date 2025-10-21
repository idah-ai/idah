# frozen_string_literal: true

require "spec_helper"

RSpec.describe Project, database: true do
  describe Project::Repository do
    system_context = Verse::Auth::Context[:system]
    system_repo = described_class.new(system_context)
    project_member_repo = ProjectMember::Repository.new(system_context)

    let!(:test_project1) {
      system_repo.find!(
        system_repo.create(
          name: "testing_project_1",
        )
      )
    }

    let!(:test_project2) {
      system_repo.find!(
        system_repo.create(
          name: "testing_project_2",
        )
      )
    }

    describe "scope definitions" do
      context "scope: all", as: :admin do
        subject { described_class.new(current_auth_context) }
        it "returns all projects" do
          projects = subject.index({})

          expect(projects.size).to eq(2)
        end
      end

      context "scope: as_user", as: :user do
        subject { described_class.new(current_auth_context) }
        before do
          @account_id = current_auth_context.metadata[:id]

          # add testing user as testing project's member
          project_member_repo.create(
            project_id: test_project2.id,
            account_id: @account_id,
            name: "test user",
            email: "test@email.com",
            access: "annotator",
          )

          # testing user creates a project
          subject.create(
            name: "user_project",
          )

          @memberships = project_member_repo.index({ account_id: @account_id })
        end

        it "returns user-scoped projects" do
          projects = subject.index({})

          expect(projects.size).to eq(2)

          # projects that is a member of or owned
          projects.each do |project|
            expect(
              @memberships.any? { |membership|
                membership.project_id == project.id
              } || project.created_by_id == @account_id
            ).to be_truthy
          end
        end
      end
    end
  end
end
