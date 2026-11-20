# frozen_string_literal: true

require "spec_helper"

Sequel.extension :pg_json

RSpec.describe CategoryCounts::Dashboard, as: :system do
  let(:project_id) { UUIDv7.generate }
  let(:dataset_id) { UUIDv7.generate }
  let(:projects) { instance_double(Project::Repository) }
  let(:datasets) { instance_double(Dataset::Repository) }
  let(:members) { instance_double(ProjectMember::Repository) }
  let(:counts) { instance_double(EntryCategoryCount::Repository) }
  let(:auth) { double("auth", metadata: { id: 3 }) }
  let(:record) { Dataset::Record.new({ id: dataset_id, name: "A", labeling_configuration: {} }) }
  let(:query) do
    host = Class.new do
      include CategoryCounts::Dashboard
      attr_accessor :projects, :datasets, :project_members, :category_count_rows, :auth_context
      public :dashboard_category_rows
    end.new
    host.projects = projects
    host.datasets = datasets
    host.project_members = members
    host.category_count_rows = counts
    host.auth_context = auth
    host
  end

  before do
    allow(projects).to receive(:find!).with(project_id)
    allow(auth).to receive(:can?).with(:read, Resource::Dataset::Datasets).and_return(:all)
  end

  it "queries all datasets without pagination and passes only scoped dataset IDs to the aggregate" do
    expect(datasets).to receive(:for_category_counts).with(project_id, nil).and_return([record])
    expect(counts).to receive(:totals_for_datasets).with([dataset_id]).and_return([])
    expect(query.dashboard_category_rows(project_id, {})).to eq([[record], []])
  end

  it "rejects inaccessible or cross-project datasets before querying counts" do
    allow(datasets).to receive(:for_category_counts).with(project_id, [dataset_id]).and_return([])
    expect(counts).not_to receive(:totals_for_datasets)
    expect { query.dashboard_category_rows(project_id, { dataset_id: [dataset_id] }) }
      .to raise_error(Verse::Error::ValidationFailed)
  end

  it "denies annotators before reading dataset configurations or annotation counts" do
    allow(auth).to receive(:can?).and_return(:as_user)
    expect(members).to receive(:owner?).with(project_id, 3).and_return(false)
    expect(datasets).not_to receive(:for_category_counts)
    expect(counts).not_to receive(:totals_for_datasets)
    expect { query.dashboard_category_rows(project_id, {}) }.to raise_error(Verse::Error::Unauthorized)
  end

  it "allows an owner and deduplicates dataset IDs" do
    allow(auth).to receive(:can?).and_return(:as_user)
    expect(members).to receive(:owner?).with(project_id, 3).and_return(true)
    expect(datasets).to receive(:for_category_counts).with(project_id, [dataset_id]).and_return([record])
    expect(counts).to receive(:totals_for_datasets).with([dataset_id]).and_return([])
    expect(query.dashboard_category_rows(project_id, { dataset_id: [dataset_id, dataset_id] })).to eq([[record], []])
  end

  it "validates IDs, unknown filters, batch limits and required batch IDs before repository access" do
    [{ dataset_id: [] }, { dataset_id: "bad" }, { dataset_id: [dataset_id] * 101 },
     { dataset_id: ["bad"] }, { other: true }].each do |filter|
      expect { query.dashboard_category_rows(project_id, filter) }.to raise_error(Verse::Error::ValidationFailed)
    end
    expect { query.dashboard_category_rows("bad", {}) }.to raise_error(Verse::Error::ValidationFailed)
    expect { query.dashboard_category_rows(project_id, {}, require_datasets: true) }
      .to raise_error(Verse::Error::ValidationFailed)
  end

  it "decodes PostgreSQL JSON configuration when reading dataset projections" do
    raw = { id: dataset_id, name: "A", labeling_configuration: Sequel.pg_jsonb(
      {
        "image:box" => { "values" => [{ "id" => "car", "label" => "Car" }] }
      }
    ) }
    repo = Dataset::Repository.new(Verse::Auth::Context[:system])
    scope = Sequel.mock(fetch: [raw])[:datasets]
    expect(repo).to receive(:scoped).with(:read).and_return(scope)
    records = repo.for_category_counts(project_id, [dataset_id])
    expect(records.first.configured_category_ids).to eq(["car"])
  end
end
