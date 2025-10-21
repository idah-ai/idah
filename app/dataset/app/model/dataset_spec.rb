# frozen_string_literal: true

require "spec_helper"

RSpec.describe Dataset, database: true do
  describe Dataset::Repository do
    system_context = Verse::Auth::Context[:system]
    system_repo = described_class.new(system_context)
    project_repo = Project::Repository.new(system_context)
    project_member_repo = ProjectMember::Repository.new(system_context)

    let!(:test_project1) {
      project_repo.find!(
        project_repo.create(
          name: "testing_project_1",
        )
      )
    }

    let!(:test_dataset1) {
      system_repo.find!(
        system_repo.create(
          project_id: test_project1.id,
          name: "testing_dataset_1",
          modality: "video",
          workflow_configuration: {},
          labeling_configuration: {},
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

    let!(:test_dataset2) {
      system_repo.find!(
        system_repo.create(
          project_id: test_project2.id,
          name: "testing_dataset_2",
          modality: "image",
          workflow_configuration: {},
          labeling_configuration: {},
        )
      )
    }

    let!(:test_project3) {
      project_repo.find!(
        project_repo.create(
          name: "testing_project_3",
        )
      )
    }

    describe "scope definitions" do
      context "scope: all", as: :admin do
        subject { described_class.new(current_auth_context) }

        it "returns all datasets" do
          datasets = subject.index({})

          expect(datasets.size).to eq(2)
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
          project_member_repo.create(
            project_id: test_project3.id,
            account_id: @account_id,
            name: "test user",
            email: "test@email.com",
            access: "annotator",
          )

          # testing user creates a dataset
          subject.create(
            project_id: test_project3.id,
            name: "user_created_dataset",
            modality: "video",
            workflow_configuration: {},
            labeling_configuration: {},
          )

          @memberships = project_member_repo.index({ account_id: @account_id })
        end

        it "returns user-scoped datasets" do
          datasets = subject.index({})

          expect(datasets.size).to eq(2)

          # datasets that are in projects that is a member of or owned datasets
          datasets.each do |dataset|
            expect(
              @memberships.any? { |membership|
                membership.project_id == dataset.project_id
              } || dataset.created_by_id == @account_id
            ).to be_truthy
          end
        end
      end
    end
  end
end
