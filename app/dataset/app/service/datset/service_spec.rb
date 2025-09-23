# frozen_string_literal: true

require "spec_helper"

RSpec.describe Datset::Service, database: true do
  let(:auth_context){ Verse::Auth::Context.new }
  let(:project_repo) { Project::Repository.new(auth_context) }
  let(:dataset_repo) { Dataset::Repository.new(auth_context) }
  let(:entry_repo) { Entry::Repository.new(auth_context) }
  let(:annotation) { Annotation::Repository.new(auth_context)}

  subject { described_class.new(auth_context) }


  let!(:project_id) do
    project_repo.create(name: "Test Project", description: "A test project", created_by_id: 1)
  end

  let!(:dataset_id) do
    dataset_repo.create(
      name: "testing dataset",
      project_id: project_id,
      modality: "video",
      labeling_configuration: {},
      workflow_configuration: {},
      status: "pending",
      progress: 0,
    )
  end

  describe "#import" do
    it "import and create records from datset structure" do
      # TODO: better mocking on dimensions, etc.
      allow(File).to receive(:read).and_return(
        {
          "dataset": {
            # "id": "019960ab-1e80-78bf-b4d2-ebc62a6d3805",
            "name": "testing dataset 01",
            "topology": "video",
            "metadata": "this should be some kind of a metadata",
            "entries": [
              {
                "id": "019960ab-c6cd-72d0-ab4f-1440d6bc09fb",
                "media_url": "testing_media1.mp4",
                "annotations": [
                  {
                    "id": "019960ab-c6cd-aaaa-ab4f-1440d6bc09fa",
                    "type": "bounding_box",
                    "dimensions": {},
                    "category": "category"
                  },
                  {
                    "id": "019960ab-c6cd-bbbb-ab4f-1440d6bc09fa",
                    "type": "bounding_box",
                    "dimensions": {},
                    "category": "category"
                  }
                ]
              },
              {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "media_url": "testing_media2.mp4",
                "annotations": [
                  {
                    "id": "019960ab-c6cd-cccc-ab4f-1440d6bc09fa",
                    "type": "bounding_box",
                    "dimensions": {},
                    "category": "category"
                  }
                ]
              }
            ]
          },
          "metadata": {
            "type": "datset",
            "version": "1.0"
          }
        }.to_json
      )

      created_dataset = subject.import(file_path: "testing_file_path.datset", project_id: project_id)

      # expectations: dataset
      expect(created_dataset.name).to eq("testing dataset 01")

      # expectations: entry
      created_entries = entry_repo.index({dataset_id: created_dataset.id})
      expect(created_entries.size).to eq(2)
      created_entry_1 = created_entries.first
      expect(created_entry_1.resource).to eq("testing_media1.mp4")
      created_entry_2 = created_entries.last
      expect(created_entry_2.resource).to eq("testing_media2.mp4")

      # expectations: annotation
    end
  end

  describe "#create_datset" do
    it "generate a correct datset structure" do
      # TODO: prep test data for dataset, entries, annotations
      subject.create_datset("019960ab-1e80-78bf-b4d2-ebc62a6d3805") # mocking id
    end
  end
end
