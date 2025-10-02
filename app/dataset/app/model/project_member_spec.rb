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
          account_id: 1,
          name: "first user",
          email: "first@email.com"
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
          email: "first@email.com"
        )
      )
    }

    let!(:membership3) {
      system_repo.find!(
        system_repo.create(
          project_id: test_project2.id,
          account_id: 2,
          name: "second user",
          email: "second@email.com"
        )
      )
    }

    describe "scope definitions" do
      context "scope: all", as: :system do
        before do
          @test_rights = ["#{described_class.resource}.*.*"]
        end
        subject { described_class.new(Verse::Auth::Context.new(@test_rights)) }
        it "returns all project members" do
          project_members = subject.index({})

          expect(project_members.size).to eq(3)
        end
      end

      # scope: memberships that are in the same project as the user
      context "scope: same_project" do
        before do
          @test_rights = ["#{described_class.resource}.read.same_project"]
          @test_account_id = 2
        end
        subject { described_class.new(Verse::Auth::Context.new(@test_rights, metadata: { id: @test_account_id })) }

        it "returns project members that are in the same project as the user" do
          project_members = subject.index({})

          expect(project_members.size).to eq(2)

          # both owned and member in same project
          expect(project_members.first.project_id).to eq(project_members.last.project_id)
        end
      end

      # scope: user's membership
      context "scope: own" do
        before do
          @test_rights = ["#{described_class.resource}.read.own"]
          @test_account_id = 2
        end
        subject { described_class.new(Verse::Auth::Context.new(@test_rights, metadata: { id: @test_account_id })) }

        it "returns owned memberships" do
          project_members = subject.index({})

          expect(project_members.size).to eq(1)

          # user's own account_id
          expect(project_members.first.account_id).to eq(@test_account_id)
        end
      end
    end
  end
end
