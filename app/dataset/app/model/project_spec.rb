# frozen_string_literal: true

require "spec_helper"

RSpec.describe Project, database: true do
  describe Project::Repository do
    system_repo = described_class.new(Verse::Auth::Context[:system])
    project_member_repo = ProjectMember::Repository.new(Verse::Auth::Context[:system])

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
          # add testing user as testing_project's member
          project_member_repo.create(
            project_id: test_project2.id,
            account_id: current_auth_context.metadata[:id],
            name: "test user",
            email: "test@email.com",
            permission_set: "annotator",
          )

          # testing user creates a project
          @user_project = subject.create(
            name: "user_project",
          )
        end

        # subject { described_class.new(current_auth_context) }
        it "returns user-scoped projects" do
          projects = subject.index({})

          # binding.pry
          expect(projects.size).to eq(2)

          # projects that is a member of or owned
          account_id = current_auth_context.metadata[:id]
          projects.each do |project|
            expect(
              project_member_repo.find_by(
                { project_id: project.id,
                  account_id: account_id }
              ) || project.created_by_id == account_id
            ).to be_truthy
          end
        end
      end
    end
  end
end
