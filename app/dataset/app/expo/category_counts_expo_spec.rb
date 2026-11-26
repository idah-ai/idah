# frozen_string_literal: true

require "spec_helper"

RSpec.describe "annotation count endpoints", type: :exposition, as: :system do
  let(:project_id) { UUIDv7.generate }
  let(:dataset_id) { UUIDv7.generate }

  it "routes category counts before annotation show and returns JSON:API with paging metadata" do
    row = CategoryCount::Record.new({ id: "row", category: "car", label: "Car", configured: true, annotation_count: 3 })
    expect_any_instance_of(Annotation::Service).to receive(:category_counts)
      .with({ project_id: }, group_by: "category", page: {}).and_return([[row], false])

    get "/annotations/category_counts?#{Rack::Utils.build_nested_query(filter: { project_id: })}"

    expect(last_response.status).to eq(200), last_response.body
    body = JSON.parse(last_response.body)
    expect(body.dig("data", 0, "type")).to eq(Resource::Dataset::CategoryCounts)
    expect(body.dig("data", 0, "attributes", "annotation_count")).to eq(3)
    expect(body.dig("meta", "more")).to be(false)
  end

  it "routes total counts with explicit dataset filters" do
    row = TotalCategoryCount::Record.new({ id: dataset_id, dataset_id:, annotation_count: 0 })
    expect_any_instance_of(Annotation::Service).to receive(:total_category_counts)
      .with({ project_id:, dataset_id: [dataset_id] }, group_by: "dataset", page: {}).and_return([[row], false])

    query = Rack::Utils.build_nested_query(filter: { project_id:, dataset_id: [dataset_id] }, group_by: "dataset")
    get "/annotations/total_category_counts?#{query}"

    expect(last_response.status).to eq(200), last_response.body
    body = JSON.parse(last_response.body)
    expect(body.dig("data", 0, "type")).to eq(Resource::Dataset::TotalCategoryCounts)
    expect(body.dig("data", 0, "attributes", "annotation_count")).to eq(0)
  end
end
