# frozen_string_literal: true

require "spec_helper"

RSpec.describe Entry, database: true do
  describe Entry::Repository do
    system_context = Verse::Auth::Context[:system]
    system_repo = described_class.new(system_context)
    project_repo = Project::Repository.new(system_context)
    project_member_repo = ProjectMember::Repository.new(system_context)
    dataset_repo = Dataset::Repository.new(system_context)

    let!(:test_project1) {
      project_repo.find!(
        project_repo.create(
          name: "testing_project_1",
        )
      )
    }

    let!(:test_dataset1) {
      dataset_repo.find!(
        dataset_repo.create(
          project_id: test_project1.id,
          name: "testing_dataset_1",
          modality: "video",
          workflow_configuration: {},
          labeling_configuration: {},
        )
      )
    }

    let!(:test_entry1) { system_repo.find!(system_repo.create(dataset_id: test_dataset1.id)) }

    let!(:other_test_project) {
      project_repo.find!(
        project_repo.create(
          name: "other_test_project",
        )
      )
    }

    let!(:other_test_dataset) {
      dataset_repo.find!(
        dataset_repo.create(
          project_id: other_test_project.id,
          name: "other_test_dataset",
          modality: "image",
          workflow_configuration: {},
          labeling_configuration: {},
        )
      )
    }

    let!(:other_test_entry) { system_repo.find!(system_repo.create(dataset_id: other_test_dataset.id)) }

    describe "scope definitions" do
      context "scope: all", as: :admin do
        subject { described_class.new(current_auth_context) }

        it "returns all datasets" do
          entries = subject.index({})

          expect(entries.size).to eq(2)
        end
      end

      context "scope: as_user", as: :user do
        subject { described_class.new(current_auth_context) }
        before do
          @account_id = current_auth_context.metadata[:id]

          # add testing user as testing project's member
          project_member_repo.create(
            project_id: test_project1.id,
            account_id: @account_id,
            name: "test user",
            email: "test@email.com",
            permission_set: "annotator",
          )

          # testing user creates an entry
          subject.create(dataset_id: test_dataset1.id)

          @memberships = project_member_repo.index({ account_id: @account_id })
        end

        it "returns user-scoped entires" do
          entries = subject.index({})

          expect(entries.size).to eq(2)

          # entries that are in projects/datasets that is a member of or owned entries
          member_datasets = dataset_repo.index({ project_id: @memberships.map(&:project_id).uniq })
          entries.each do |entry|
            expect(
              member_datasets.any? { |dataset|
                dataset.id == entry.dataset_id
              } || entry.created_by_id == @account_id
            ).to be_truthy
          end
        end
      end
    end
  end
end
