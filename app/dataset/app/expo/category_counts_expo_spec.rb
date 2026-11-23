# frozen_string_literal: true

require "spec_helper"

RSpec.describe "category count endpoints", type: :exposition, as: :system do
  let(:entry_id) { UUIDv7.generate }
  let(:dataset_id) { UUIDv7.generate }

  it "routes project totals with dataset filters to the service" do
    project_id = UUIDv7.generate
    row = ProjectCategoryTotal::Record.new(
      { id: "total", project_id:, category: "car", label: "Car", annotation_count: 3,
        configured: true, datasets: [{ id: dataset_id, name: "Dataset", annotation_count: 3 }] }
    )
    expect_any_instance_of(Project::Service).to receive(:category_counts)
      .with(project_id, { dataset_id: [dataset_id] }).and_return([row])

    query = Rack::Utils.build_nested_query(filter: { dataset_id: [dataset_id] })
    get "/projects/#{project_id}/category_counts?#{query}"

    expect(last_response.status).to eq(200), last_response.body
    body = JSON.parse(last_response.body)
    expect(body.fetch("data").first.fetch("type")).to eq(Resource::Dataset::ProjectCategoryTotals)
    expect(body.fetch("data").first.dig("attributes", "label")).to eq("Car")
    expect(body.fetch("data").first.dig("attributes", "datasets"))
      .to eq([{ "id" => dataset_id, "name" => "Dataset", "annotation_count" => 3 }])
    expect(body.fetch("data").first.fetch("attributes")).not_to have_key("label_conflict")
  end

  it "routes batch totals before the dataset show route" do
    project_id = UUIDv7.generate
    expect_any_instance_of(Dataset::Service).to receive(:category_counts_batch)
      .with({ project_id:, dataset_id: [dataset_id] }).and_return([])

    get "/datasets/category_counts?#{Rack::Utils.build_nested_query(filter: { project_id:, dataset_id: [dataset_id] })}"

    expect(last_response.status).to eq(200), last_response.body
    expect(JSON.parse(last_response.body).fetch("data")).to eq([])
  end

  it "returns JSON:API rows for one entry" do
    row = EntryCategoryCount::Record.new(
      {
        id: UUIDv7.generate, entry_id:, dataset_id:, project_id: UUIDv7.generate,
        category: "car", count: 2
      }
    )
    allow_any_instance_of(Entry::Service).to receive(:category_counts).with(entry_id).and_return([row])

    get "/entries/#{entry_id}/category_counts"

    expect(last_response.status).to eq(200), last_response.body
    body = JSON.parse(last_response.body)
    expect(body.fetch("data").map { |record| [record.fetch("type"), record.dig("attributes", "count")] })
      .to eq([[Resource::Dataset::EntryCategoryCounts, 2]])
  end

  it "returns JSON:API totals for one dataset" do
    row = DatasetCategoryTotal::Record.new(
      {
        id: "#{dataset_id}:car", dataset_id:, category: "car", annotation_count: 3
      }
    )
    allow_any_instance_of(Dataset::Service).to receive(:category_counts).with(dataset_id).and_return([row])

    get "/datasets/#{dataset_id}/category_counts"

    expect(last_response.status).to eq(200), last_response.body
    body = JSON.parse(last_response.body)
    expect(body.fetch("data").map { |record| [record.fetch("type"), record.dig("attributes", "annotation_count")] })
      .to eq([[Resource::Dataset::CategoryTotals, 3]])
  end

  it "denies an annotator dataset totals over HTTP", database: true, as: :annotator do
    system = Verse::Auth::Context[:system]
    project_id = Project::Repository.new(system).create(
      name: "Count access", created_by_email: "system@example.com", organization_id: 1
    )
    dataset_id = Dataset::Repository.new(system).create(
      project_id:,
      name: "Count access",
      modality: "image",
      labels: [],
      labeling_configuration: {},
      workflow_configuration: {}
    )
    ProjectMember::Repository.new(system).create(
      project_id:, account_id: 4, role: "annotator", email: "annotator@example.com", invited_by_id: 1
    )
    Entry::Repository.new(system).create(
      project_id:, dataset_id:, status: "pending", wf_step: "annotate", assigned_to_id: 4
    )

    get "/datasets/#{dataset_id}/category_counts"

    expect(last_response.status).to eq(403)
  end
end
