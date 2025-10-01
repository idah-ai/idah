# frozen_string_literal: true

require "spec_helper"

RSpec.describe Project, database: true do
  describe Project::Repository do
    # subject{ described_class.new(Verse::Auth::Context.new) }
    system_repo = described_class.new(Verse::Auth::Context[:system])

    let(:account_id) { 1 } # TODO: mocking, should be taken from context

    # let(:project1) {
    #   subject.create
    # }

    # describe "#scope:all" do

    let!(:test_project1) {
      system_repo.find!(
        system_repo.create(
          name: "testing_project_1",
          created_by_id: 1
        )
      )
    }
    let!(:test_project2) {
      system_repo.find!(
        system_repo.create(
          name: "testing_project_2",
          created_by_id: 999
        )
      )
    }
    # let!(:test_project3) {
    #   repo.find!(
    #     repo.create(
    #       name: "testing_project_3",
    #       created_by_id: 2
    #     )
    #   )
    # }

    context "#scope:all", as: :system do
      subject { described_class.new(current_auth_context) }
      it "returns all projects" do
        projects = system_repo.index({})

        expect(projects.size).to eq(2)
      end
    end

    describe "#scope:own", as: :project_manager do
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
        binding.pry

        expect(own_projects.size).to eq(1)
        expect(own_projects.first.name).to eq("testing_project_created")
      end
    end

    describe "#scope:member" do
      xit "returns projects the user is a member of" do
      end
    end
  end
end
