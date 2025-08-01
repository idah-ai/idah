# frozen_string_literal: true

require "spec_helper"

RSpec.describe Dataset::Service, database: true do
  let(:auth_context){ Verse::Auth::Context.new }

  subject { described_class.new(auth_context) }

  let(:repo) { Dataset::Repository.new(auth_context) }
  let(:project_repo) { Project::Repository.new(auth_context) }

  let!(:project_id) do
    project_repo.create(name: "Test Project", description: "A test project", created_by_id: 1)
  end

  let(:attributes) do
    {
      topology: "image_labeling",
      labels: ["cat", "dog"],
      configuration: { "width" => 100, "height" => 100 },
      project_id: project_id
    }
  end

  describe "#create" do
    it "creates a new dataset" do
      record = deserialize(
        {
          data: {
            type: "datasets",
            attributes: attributes
          }
        }
      )
      dataset = subject.create(record)
      expect(dataset.topology).to eq("image_labeling")
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
