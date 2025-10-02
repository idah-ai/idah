# frozen_string_literal: true

require "spec_helper"

RSpec.describe ProjectMember, database: true do
  describe ProjectMember::Repository do
    system_repo = described_class.new(Verse::Auth::Context[:system])
    project_repo = Project::Repository.new(Verse::Auth::Context[:system])

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
          account_id: Verse::Spec.users[:annotator][:user_data][:id],
          name: "annotator user",
          email: "annotator@email.com"
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
          account_id: Verse::Spec.users[:annotator][:user_data][:id],
          name: "annotator user",
          email: "annotator@email.com"
        )
      )
    }

    let!(:membership3) {
      system_repo.find!(
        system_repo.create(
          project_id: test_project2.id,
          account_id: Verse::Spec.users[:reviewer][:user_data][:id],
          name: "reviewer user",
          email: "reviewer@email.com"
        )
      )
    }

    describe "scope definitions" do
      context "scope: all", as: :system do
        subject { described_class.new(current_auth_context) }
        it "returns all project members" do
          project_members = subject.index({})

          expect(project_members.size).to eq(3)
        end
      end

      # scope: memberships that are in the same project as the user
      context "scope: same_project", as: :reviewer do
        subject { described_class.new(current_auth_context) }
        it "returns project members that are in the same project as the user" do
          project_members = subject.index({})

          expect(project_members.size).to eq(2)
        end
      end

      # scope: user's membership
      context "scope: own", as: :annotator do
        subject { described_class.new(current_auth_context) }
        xit "returns all memberships" do
        end
      end
    end
  end
end
