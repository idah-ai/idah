# frozen_string_literal: true

require "spec_helper"

RSpec.describe Datset::Service, database: true do
  let(:auth_context){ Verse::Auth::Context.new }
  let(:project_repo) { Project::Repository.new(auth_context) }
  let(:dataset_repo) { Dataset::Repository.new(auth_context) }

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
      subject.import(file_path: "", project_id: "")
    end
  end

  describe "#export" do
    it "generate a correct datset structure" do
      subject.export(dataset_id)
    end
  end
end
