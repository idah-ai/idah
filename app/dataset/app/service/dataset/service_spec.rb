# frozen_string_literal: true

require "spec_helper"

RSpec.describe Dataset::Service, database: true do
  let(:auth_context){ Verse::Auth::Context.new }

  subject { described_class.new(auth_context) }

  let(:repo) { Dataset::Repository.new(auth_context) }
  let(:project_repo) { Project::Repository.new(auth_context) }

  let!(:project_id) do
    project_repo.create(name: "Test Project", description: "A test project", created_by_email: "user@example.com")
  end

  let(:attributes) do
    {
      modality: "image_labeling",
      labels: ["cat", "dog"],
      labeling_configuration: {},
      workflow_configuration: {},
      project_id: project_id
    }
  end

  describe "#index" do
    it "returns all datasets" do
      dataset1_id = repo.create(attributes)
      dataset2_id = repo.create(attributes.merge(labels: ["bird", "fish"]))

      result = subject.index

      expect(result.count).to eq(2)
      expect(result.map(&:id)).to include(dataset1_id, dataset2_id)
    end

    it "returns datasets with pagination" do
      repo.create(attributes)
      repo.create(attributes.merge(labels: ["bird", "fish"]))

      result = subject.index({}, page: 1, items_per_page: 1)

      expect(result.count).to eq(1)
    end

    it "returns datasets with filter" do
      dataset1_id = repo.create(attributes)
      repo.create(attributes.merge(labels: ["bird", "fish"]))

      result = subject.index({ id: dataset1_id })

      expect(result.count).to eq(1)
      expect(result.first.id).to eq(dataset1_id)
    end
  end

  describe "#create" do
    it "creates a new dataset" do
      record = deserialize(
        {
          data: {
            type: "datasets",
            attributes: attributes,
            relationships: {
              project: {
                data: {
                  type: "projects",
                  id: project_id
                }
              }
            }
          }
        }
      )
      dataset = subject.create(record)
      expect(dataset.modality).to eq("image_labeling")
      expect(dataset.labels).to eq(["cat", "dog"])
    end
  end

  describe "#show" do
    it "shows a dataset" do
      dataset_id = repo.create(attributes)

      found_dataset = subject.show(dataset_id)
      expect(found_dataset.id).to eq(dataset_id)
    end
  end

  describe "#update" do
    it "updates a dataset" do
      dataset_id = repo.create(attributes)

      record = deserialize(
        {
          data: {
            type: "datasets",
            id: dataset_id,
            attributes: {
              labels: ["cat", "dog", "bird"],
            }
          }
        }
      )

      subject.update(record)

      updated_dataset = repo.find!(dataset_id)
      expect(updated_dataset.labels).to eq(["cat", "dog", "bird"])
    end
  end

  describe "#delete" do
    it "deletes a dataset" do
      dataset_id = repo.create(attributes)
      subject.delete(dataset_id)
      expect { repo.find!(dataset_id) }.to raise_error(Verse::Error::NotFound)
    end
  end

  describe "#notify_dataset_completed" do
    let(:project_member_repo) { ProjectMember::Repository.new(auth_context) }
    let(:dataset_id) { repo.create(attributes.merge(name: "Test Dataset")) }

    before do
      # Create project owner member
      project_member_repo.create(
        project_id: project_id,
        account_id: 123,
        invited_by_id: 1,
        email: "owner@example.com",
        name: "Project Owner",
        role: "project_owner"
      )

      # Mock the notification service
      allow(::Service::Notification).to receive(:email)
    end

    it "sends notification to project owners when dataset is completed" do
      subject.notify_dataset_completed(dataset_id)

      expect(::Service::Notification).to have_received(:email).with(
        hash_including(
          to: "owner@example.com",
          title: "Dataset has been Completed",
          category: "dataset_completed",
          recipient_id: 123,
          dataset_name: "Test Dataset",
          project_name: "Test Project",
          recipient_name: "Project Owner"
        )
      )
    end

    it "sends notification to all project owners" do
      # Create another project owner
      project_member_repo.create(
        project_id: project_id,
        account_id: 456,
        email: "owner2@example.com",
        name: "Project Owner 2",
        role: "project_owner",
        invited_by_id: 1
      )

      subject.notify_dataset_completed(dataset_id)

      expect(::Service::Notification).to have_received(:email).exactly(2).times
    end

    it "does not send notification to non-owner members" do
      # Create a non-owner member
      project_member_repo.create(
        project_id: project_id,
        account_id: 789,
        email: "member@example.com",
        name: "Regular Member",
        role: "project_member",
        invited_by_id: 1
      )

      subject.notify_dataset_completed(dataset_id)

      # Should only send to the one owner, not the regular member
      expect(::Service::Notification).to have_received(:email).once
    end
  end
end
