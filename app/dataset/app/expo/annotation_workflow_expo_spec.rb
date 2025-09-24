# frozen_string_literal: true

require "spec_helper"

RSpec.describe AnnotationWorkflowExpo, type: :exposition, database: true, as: :system do
  let(:entry_id) { UUIDv7.generate }
  let(:annotator_id) { 123 }
  let(:auth_context){ Verse::Auth::Context.new }
  let(:entry_repo) { Entry::Repository.new(auth_context) }
  let(:dataset_repo) { Dataset::Repository.new(auth_context) }

  let(:project_id) do
    Project::Repository.new(auth_context).create(
      name: "Test Project", description: "A test project", created_by_id: 1
    )
  end

  let(:dataset_id) do
    dataset_repo.create(
      modality: "image",
      labels: ["cat", "dog"],
      labeling_configuration: { "width" => 100, "height" => 100 },
      workflow_configuration: {},
      project_id: project_id
    )
  end


  let(:annotation_data) do
    [
      {
        type: "bounding_box",
        dimensions: { "x" => 10, "y" => 20, "width" => 30, "height" => 40 },
        annotation: { "label" => "cat" }
      }
    ]
  end

  before do
    entry_repo.create(
      id: entry_id,
      dataset_id: dataset_id,
      assigned_to_id: 1,
      wf_step: "start",
      status: "ready"
    )
  end

  it "start annotation workflow" do
    post "/annotation_workflow/start", {
      data: {
        attributes: {
          entry_id: entry_id
        }
      }
    }

    expect(last_response.status).to eq 200
    # body = JSON.parse(last_response.body, symbolize_names: true)
    # expect(body[:entry][:id]).to eq entry_id
    # expect(body[:workflow_step]).to eq "annotation"
    # expect(body[:status]).to eq "in_progress"
    # expect(body[:available_actions]).to include("submit_annotation", "reset_workflow")
    # expect(body[:progress]).to eq 0.5
    # expect(body[:message]).to eq "Annotation workflow started successfully"
  end

  it "submit annotation" do
    started_entry = entry_repo.create(
      id: UUIDv7.generate,
      dataset_id: dataset_id,
      assigned_to_id: 1,
      wf_step: "annotate",
      status: "in_progress"
    )

    post "/annotation_workflow/submit", {
      data: {
        attributes: {
          entry_id: started_entry,
          annotator_id:,
          annotation_data: annotation_data
        }
      }
    }

    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    expect(body[:entry][:id]).to eq started_entry
    expect(body[:workflow_step]).to eq "done"
    expect(body[:status]).to eq "completed"
    expect(body[:available_actions]).to include("reset_workflow")
    expect(body[:progress]).to eq 1.0
    expect(body[:message]).to eq "Annotation submitted successfully"
  end
end
