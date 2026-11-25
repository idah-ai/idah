# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Dashboard category totals", database: true, as: :project_owner do
  let(:system) { Verse::Auth::Context[:system] }
  let(:projects) { Project::Repository.new(system) }
  let(:datasets) { Dataset::Repository.new(system) }
  let(:entries) { Entry::Repository.new(system) }
  let(:annotations) { Annotation::Repository.new(system) }
  let!(:project_id) { projects.create(name: "Categories", organization_id: 1, created_by_email: "system@example.com") }
  let!(:other_project_id) { projects.create(name: "Other", organization_id: 1, created_by_email: "system@example.com") }
  let!(:first_id) { create_dataset(project_id, "First", "Car") }
  let!(:second_id) { create_dataset(project_id, "Second", "Vehicle") }
  let!(:third_id) { create_dataset(project_id, "Third", "Car") }
  let!(:foreign_id) { create_dataset(other_project_id, "Foreign", "Car") }

  def create_dataset(project, name, label)
    datasets.create(
      project_id: project,
      name:,
      modality: "image",
      labels: [],
      workflow_configuration: {},
      labeling_configuration: { "image:box" => { values: [{ id: "car", label: },
                                                          { id: "person", label: "Person" }] } }
    )
  end

  def annotate(dataset_id, category, count)
    entry_id = entries.create(project_id:, dataset_id:, status: "pending", wf_step: "annotate")
    count.times do
      annotations.create(
        project_id:,
        dataset_id:,
        entry_id:,
        category:,
        shape_type: "image:box",
        shape_args: {},
        created_by_email: "system@example.com"
      )
    end
  end

  before do
    ProjectMember::Repository.new(system).create(
      project_id:,
      account_id: 3,
      role: "project_owner",
      email: "owner@example.com",
      invited_by_id: 1
    )
    ProjectMember::Repository.new(system).create(
      project_id:,
      account_id: 4,
      role: "annotator",
      email: "annotator@example.com",
      invited_by_id: 1
    )
    annotate(first_id, "car", 2)
    annotate(second_id, "car", 3)
    annotate(third_id, "car", 1)
    annotate(first_id, "removed", 1)
  end

  it "combines matching IDs across datasets while preserving zeros and removed categories" do
    rows = Project::Service.new(current_auth_context).category_counts(project_id)
    cars = rows.select { |row| row.category == "car" }
    expect(cars.map { |row| [row.label, row.annotation_count] }).to eq([["car", 6]])
    expect(cars.first.datasets)
      .to contain_exactly(
        { id: first_id, name: "First", label: "Car", configured: true, annotation_count: 2 },
        { id: second_id, name: "Second", label: "Vehicle", configured: true, annotation_count: 3 },
        { id: third_id, name: "Third", label: "Car", configured: true, annotation_count: 1 }
      )
    expect(rows.find { |row| row.category == "person" }.annotation_count).to eq(0)
    expect(rows.find { |row| row.category == "person" }.datasets)
      .to include(id: first_id, name: "First", label: "Person", configured: true, annotation_count: 0)
    expect(rows.find { |row| row.category == "removed" }.configured).to be(false)
    expect(rows.find { |row| row.category == "removed" }.datasets)
      .to eq([{ id: first_id, name: "First", label: "removed", configured: false, annotation_count: 1 }])
    expect(rows.sum(&:annotation_count)).to eq(7)
    expect(rows.map(&:id).uniq.length).to eq(rows.length)
  end

  it "limits totals and contributing datasets to the requested scope" do
    rows = Project::Service.new(current_auth_context).category_counts(project_id, { dataset_id: [first_id] })
    car = rows.find { |row| row.category == "car" }
    expect([car.label, car.annotation_count]).to eq(["Car", 2])
    expect(car.datasets).to eq([{ id: first_id, name: "First", label: "Car", configured: true, annotation_count: 2 }])
  end

  it "returns a batch of separate dataset totals" do
    rows = Dataset::Service.new(current_auth_context).category_counts_batch(
      { project_id:,
        dataset_id: [first_id, second_id] }
    )
    expect(rows.select { |row| row.category == "car" }.map { |row| [row.dataset_id, row.label, row.annotation_count] })
      .to contain_exactly([first_id, "Car", 2], [second_id, "Vehicle", 3])
  end

  it "rejects datasets outside the project instead of returning incomplete totals" do
    expect { Project::Service.new(current_auth_context).category_counts(project_id, { dataset_id: [first_id, foreign_id] }) }
      .to raise_error(Verse::Error::ValidationFailed)
  end

  it "rejects invalid, empty and oversized scopes" do
    [{ dataset_id: [] }, { dataset_id: "bad" }, { dataset_id: [first_id] * 101 }, { unknown: true }].each do |filter|
      expect { Project::Service.new(current_auth_context).category_counts(project_id, filter) }
        .to raise_error(Verse::Error::ValidationFailed)
    end
    expect { Dataset::Service.new(current_auth_context).category_counts_batch({ project_id: }) }
      .to raise_error(Verse::Error::ValidationFailed)
  end

  it "rejects annotators even when they can read the project", as: :annotator do
    expect { Project::Service.new(current_auth_context).category_counts(project_id) }
      .to raise_error(Verse::Error::Unauthorized)
    expect { Dataset::Service.new(current_auth_context).category_counts_batch({ project_id:, dataset_id: [first_id] }) }
      .to raise_error(Verse::Error::Unauthorized)
  end

  it "returns an empty collection for an empty project", as: :system do
    expect(
      Project::Service.new(current_auth_context).category_counts(other_project_id, { dataset_id: [foreign_id] })
            .map(&:annotation_count)
    ).to eq([0, 0])
    empty_id = projects.create(name: "Empty", organization_id: 1, created_by_email: "system@example.com")
    expect(Project::Service.new(current_auth_context).category_counts(empty_id)).to eq([])
  end
end
