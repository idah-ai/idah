# frozen_string_literal: true

require "spec_helper"

RSpec.describe Datset::Service, database: true do
  let(:auth_context){ Verse::Auth::Context.new }
  let(:project_repo) { Project::Repository.new(auth_context) }
  let(:dataset_repo) { Dataset::Repository.new(auth_context) }
  let(:entry_repo) { Entry::Repository.new(auth_context) }
  let(:annotation_repo) { Annotation::Repository.new(auth_context) }

  subject { described_class.new(auth_context) }

  let(:default_datset_metadata) do { type: "datset", version: "1.0" } end

  let(:project_id) do
    project_repo.create(name: "Test Project", description: "A test project", created_by_id: 1)
  end

  let!(:test_dataset) do
    id = dataset_repo.create(
      name: "testing dataset",
      project_id: project_id,
      modality: "video",
      labeling_configuration: {},
      workflow_configuration: {},
      status: "pending",
      progress: 0,
    )
    dataset_repo.find(id)
  end

  let!(:test_entry1) do
    id = entry_repo.create(
      dataset_id: test_dataset.id,
      resource: "first_entry_resource.mp4",
    )
    entry_repo.find(id)
  end

  let!(:test_annotation1) do
    id = annotation_repo.create(
      entry_id: test_entry1.id,
      dimensions: {},
      annotation: {},
    )
    annotation_repo.find(id)
  end

  let!(:test_annotation2) do
    id = annotation_repo.create(
      entry_id: test_entry1.id,
      dimensions: {},
      annotation: {},
    )
    annotation_repo.find(id)
  end

  let!(:test_entry2) do
    id = entry_repo.create(
      dataset_id: test_dataset.id,
      resource: "second_entry_resource.mp4",
    )
    entry_repo.find(id)
  end

  let!(:test_annotation3) do
    id = annotation_repo.create(
      entry_id: test_entry2.id,
      dimensions: {},
      annotation: {},
    )
    annotation_repo.find(id)
  end

  let(:testing_file_path) { "./spec_data/sample.datset" }

  describe "#import" do
    it "import and create records from datset structure" do
      file = File.open(testing_file_path, "rb")
      testing_file = Verse::Http::UploadedFileStruct.new(
        {
          filename: "sample.datset",
          type: "application/octet-stream",
          tempfile: file
        }
      )
      created_dataset = subject.import(file: testing_file, project_id: project_id)

      # expectations: dataset
      expect(created_dataset.name).to eq("testing dataset 01")
      expect(created_dataset.modality).to eq("video")

      # expectations: entry
      created_entries = entry_repo.index({ dataset_id: created_dataset.id })
      expect(created_entries.size).to eq(2)
      expect(created_entries.first.resource).to eq("testing_media1.mp4")
      expect(created_entries.last.resource).to eq("testing_media2.mp4")

      # expectations: annotation
    ensure
      file&.close
    end
  end

  describe "#create_datset" do
    it "generate a correct datset structure" do
      # generate datset structure to be exported from a dataset
      datset = subject.create_datset(test_dataset.id)

      # datset structure expectations
      expect(datset[:metadata]).to eq(default_datset_metadata)

      # expectations: dataset
      dataset = datset[:dataset]
      expect(dataset[:id]).to eq(test_dataset.id)

      # expectations: entry
      entries = dataset[:entries]
      expect(datset[:dataset][:entries].size).to eq(2)
      expect(entries.first[:id]).to eq(test_entry1.id)
      expect(entries.first[:media_url]).to eq(test_entry1.resource)
      expect(entries.last[:id]).to eq(test_entry2.id)
      expect(entries.last[:media_url]).to eq(test_entry2.resource)

      # expectations: annotation
    end
  end
end
