# frozen_string_literal: true

require "spec_helper"

RSpec.describe Annotation::Service, database: true do
  let(:system) { Verse::Auth::Context[:system] }
  let(:projects) { Project::Repository.new(system) }
  let(:datasets) { Dataset::Repository.new(system) }
  let(:entries) { Entry::Repository.new(system) }
  let(:annotations) { Annotation::Repository.new(system) }
  let!(:project_id) { projects.create(name: "Counts", organization_id: 1, created_by_email: "system@example.com") }
  let!(:other_project_id) { projects.create(name: "Other", organization_id: 1, created_by_email: "system@example.com") }
  let!(:first_id) { create_dataset(project_id, "Car") }
  let!(:second_id) { create_dataset(project_id, "Vehicle") }
  let!(:foreign_id) { create_dataset(other_project_id, "Foreign") }
  let!(:first_entry) {
    entries.create(project_id:, dataset_id: first_id, status: "pending", wf_step: "annotate", assigned_to_id: 4)
  }
  let!(:second_entry) {
    entries.create(project_id:, dataset_id: second_id, status: "pending", wf_step: "annotate", assigned_to_id: 3)
  }
  let!(:foreign_entry) {
    entries.create(project_id: other_project_id, dataset_id: foreign_id, status: "pending", wf_step: "annotate")
  }

  def create_dataset(project, label)
    datasets.create(
      project_id: project,
      name: label,
      modality: "image",
      labels: [],
      workflow_configuration: {},
      labeling_configuration: { "image:box" => { values: [{ id: "car", label: },
                                                          { id: "person", label: "Person" }] } }
    )
  end

  def annotate(entry_id, dataset_id, category)
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
    annotate(first_entry, first_id, "car")
    annotate(first_entry, first_id, "removed")
    annotate(second_entry, second_id, "car")
  end

  it "returns complete category totals, configured zeros, and conflict labels", as: :project_owner do
    rows, more = described_class.new(current_auth_context).category_counts({ project_id: })
    expect(more).to be(false)
    expect(rows.map { |row| [row.category, row.label, row.configured, row.annotation_count] })
      .to eq([["car", "car", true, 2], ["person", "Person", true, 0], ["removed", "removed", false, 1]])
  end

  it "returns all explicit dataset totals including zeros and scopes breakdowns", as: :project_owner do
    service = described_class.new(current_auth_context)
    empty_id = create_dataset(project_id, "Empty")
    rows, more = service.total_category_counts(
      { project_id:, dataset_id: [first_id, second_id, empty_id] },
      group_by: "dataset"
    )
    expect(more).to be(false)
    expect(rows.map { |row| [row.dataset_id, row.annotation_count] })
      .to contain_exactly([first_id, 2], [second_id, 1], [empty_id, 0])
    rows, = service.category_counts({ project_id:, dataset_id: [first_id], category: "car" }, group_by: "dataset")
    expect(rows.map { |row| [row.dataset_id, row.label, row.annotation_count] }).to eq([[first_id, "Car", 1]])
  end

  it "pages complete grouped rows and preserves totals across pages", as: :project_owner do
    10.times do
      dataset_id = create_dataset(project_id, "Car")
      entry_id = entries.create(project_id:, dataset_id:, status: "pending", wf_step: "annotate")
      annotate(entry_id, dataset_id, "car")
    end
    service = described_class.new(current_auth_context)
    first, more = service.category_counts(
      { project_id:, category: "car" },
      group_by: "dataset",
      page: { number: 1, size: 10 }
    )
    second, last = service.category_counts(
      { project_id:, category: "car" },
      group_by: "dataset",
      page: { number: 2, size: 10 }
    )
    expect([first.length, second.length, more, last]).to eq([10, 2, true, false])
    expect((first + second).sum(&:annotation_count)).to eq(12)
  end

  it "ignores irregular tool and values JSON while retaining valid categories", as: :project_owner do
    id = create_dataset(project_id, "Empty")
    datasets.update!(
      id,
      { labeling_configuration: {
        "bad-tool" => "unexpected", "bad-values" => { values: "unexpected" },
        "valid" => { values: [{ id: "bike", label: "Bike" }] }
      } }
    )
    rows, = described_class.new(current_auth_context).category_counts({ project_id: })
    expect(rows.find { |row| row.category == "bike" }.annotation_count).to eq(0)
  end

  it "follows entry visibility but retains configured zeros from readable datasets", as: :annotator do
    service = described_class.new(current_auth_context)
    rows, = service.category_counts({ project_id: })
    expect(rows.map { |row| [row.category, row.annotation_count] }).to include(["car", 1], ["person", 0])
    rows, = service.total_category_counts({ project_id: })
    expect(rows.first.annotation_count).to eq(2)
    expect { service.category_counts({ entry_id: [second_entry] }, group_by: "entry") }
      .to raise_error(Verse::Error::ValidationFailed)
  end

  it "derives one project from explicit entries and permits coarser grouping", as: :project_owner do
    service = described_class.new(current_auth_context)
    rows, = service.category_counts({ entry_id: [first_entry] }, group_by: "entry")
    expect(rows.map { |row| [row.entry_id, row.category, row.annotation_count] })
      .to contain_exactly([first_entry, "car", 1], [first_entry, "removed", 1])
    totals, = service.total_category_counts({ entry_id: [first_entry] })
    expect(totals.map { |row| [row.project_id, row.annotation_count] }).to eq([[project_id, 2]])
    totals, = service.total_category_counts({ project_id:, entry_id: [first_entry] }, group_by: "entry")
    expect(totals.map { |row| [row.entry_id, row.annotation_count] }).to eq([[first_entry, 2]])
  end

  it "normalizes uppercase UUID filters for both count endpoints", as: :project_owner do
    service = described_class.new(current_auth_context)
    filters = { project_id: project_id.upcase, dataset_id: [first_id.upcase], entry_id: [first_entry.upcase] }
    rows, = service.category_counts(filters, group_by: "entry")
    expect(rows.map { |row| [row.entry_id, row.category, row.annotation_count] })
      .to contain_exactly([first_entry, "car", 1], [first_entry, "removed", 1])
    totals, = service.total_category_counts(filters, group_by: "entry")
    expect(totals.map { |row| [row.entry_id, row.annotation_count] }).to eq([[first_entry, 2]])
    totals, = service.total_category_counts(
      { project_id:, dataset_id: [first_id.upcase, first_id] },
      group_by: "dataset"
    )
    expect(totals.map { |row| [row.dataset_id, row.annotation_count] }).to eq([[first_id, 2]])
  end

  it "rejects mixed-project entries, foreign datasets, malformed filters, and unbounded entry grouping",
     as: :project_owner do
    service = described_class.new(current_auth_context)
    [{ entry_id: [first_entry, foreign_entry] }, { project_id:, dataset_id: [foreign_id] },
     { project_id:, dataset_id: [] }, { project_id:, entry_id: [] },
     { project_id:, dataset_id: [first_id] * 101 }, { project_id:, dataset_id: ["bad"] },
     { project_id:, unknown: "x" }, {}].each do |filter|
      expect { service.category_counts(filter) }.to raise_error(Verse::Error::ValidationFailed)
    end
    expect { service.category_counts({ project_id: }, group_by: "entry") }.to raise_error(Verse::Error::ValidationFailed)
    expect { service.total_category_counts({ project_id:, category: "car" }) }.to raise_error(Verse::Error::ValidationFailed)
    expect { service.total_category_counts({ project_id: }, group_by: "category") }.to raise_error(Verse::Error::ValidationFailed)
    expect { service.total_category_counts({ project_id: }, group_by: "dataset", page: { size: 9 }) }
      .to raise_error(Verse::Error::ValidationFailed)
    expect { service.total_category_counts({ project_id: }, group_by: "dataset", page: { size: 501 }) }
      .to raise_error(Verse::Error::ValidationFailed)
    expect { service.category_counts({ project_id: }, group_by: "unknown") }
      .to raise_error(Verse::Error::ValidationFailed)
    expect { service.category_counts({ project_id: }, page: { number: 2 }) }
      .to raise_error(Verse::Error::ValidationFailed)
  end
end
