# frozen_string_literal: true

require "spec_helper"

RSpec.describe Annotation::Service, database: true do
  let(:auth_context){ Verse::Auth::Context.new }

  subject { described_class.new(auth_context) }

  let(:repo) { Annotation::Repository.new(auth_context) }
  let(:project_repo) { Project::Repository.new(auth_context) }
  let(:dataset_repo) { Dataset::Repository.new(auth_context) }
  let(:entry_repo) { Entry::Repository.new(auth_context) }

  let!(:project_id) do
    project_repo.create(name: "Test Project", description: "A test project", created_by_id: 1)
  end

  let!(:dataset_id) do
    dataset_repo.create(
      modality: "image_labeling",
      labels: ["cat", "dog"],
      labeling_configuration: { "width" => 100, "height" => 100 },
      workflow_configuration: {},
      project_id: project_id
    )
  end

  let!(:entry_id) do
    entry_repo.create(
      priority: 1,
      wf_step: "start",
      status: "pending",
      assigned_to_id: 1,
      dataset_id: dataset_id
    )
  end

  let(:attributes) do
    {
      entry_id: entry_id,
      type: "bounding_box",
      dimensions: { "x" => 10, "y" => 20, "width" => 30, "height" => 40 },
      annotation: { label: "cat" },
      created_by_id: 1
    }
  end

  describe "#create" do
    it "creates a new annotation" do
      record = deserialize(
        {
          data: {
            type: "annotations",
            attributes: attributes,
            relationships: {
              entry: {
                data: {
                  type: "dataset:entries",
                  id: entry_id
                }
              }
            }
          }
        }
      )
      annotation = subject.create(record)
      # expect(annotation.type).to eq("bounding_box")
      expect(annotation.annotation).to eq({ label: "cat" })
    end
  end

  describe "#show" do
    it "shows an annotation" do
      annotation_id = repo.create(attributes)
      found_annotation = subject.show(annotation_id)
      expect(found_annotation.id).to eq(annotation_id)
    end
  end

  describe "#update" do
    it "updates an annotation" do
      annotation_id = repo.create(attributes)
      record = deserialize(
        {
          data: {
            type: "annotations",
            id: annotation_id,
            attributes: {
              annotation: { label: "dog" },
            }
          }
        }
      )

      subject.update(record)

      updated_annotation = repo.find!(annotation_id)
      expect(updated_annotation.annotation).to eq({ label: "dog" })
    end
  end

  describe "#delete" do
    it "deletes an annotation" do
      annotation_id = repo.create(attributes)
      subject.delete(annotation_id)
      expect { repo.find!(annotation_id) }.to raise_error(Verse::Error::NotFound)
    end
  end
end
