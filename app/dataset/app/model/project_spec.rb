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
      context "#scope:all", as: :system do
        subject { described_class.new(current_auth_context) }
        it "returns all projects" do
          projects = system_repo.index({})

          expect(projects.size).to eq(2)
        end
      end

      # scope: projects the user owns/creates
      context "#scope:own", as: :project_manager do
        subject { described_class.new(current_auth_context) }
        before do
          @created_project = system_repo.find!(
            subject.create(
              name: "testing_project_created",
            )
          )
        end
        it "returns projects the user owns/creates" do
          own_projects = subject.index({})

          expect(own_projects.size).to eq(1)
          expect(own_projects.first.name).to eq(@created_project.name)
        end
      end

      # scope: projects the user is a member of
      context "#scope:member", as: :annotator do
        subject { described_class.new(current_auth_context) }
        before do
          @testing_project = test_project2
          project_member_repo.find!(
            project_member_repo.create(
              project_id: @testing_project.id,
              account_id: current_auth_context.metadata[:id],
              name: "annotator_member",
              email: "annotator@email.com",
            )
          )
        end
        it "returns projects the user is a member of" do
          member_projects = subject.index({})

          expect(member_projects.size).to eq(1)
          expect(member_projects.first.name).to eq(@testing_project.name)
        end
      end
    end
  end
end
