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
end
