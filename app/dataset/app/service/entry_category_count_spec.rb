# frozen_string_literal: true

require "spec_helper"

RSpec.describe "category count reads", database: true do
  let(:system) { Verse::Auth::Context[:system] }
  let(:projects) { Project::Repository.new(system) }
  let(:members) { ProjectMember::Repository.new(system) }
  let(:datasets) { Dataset::Repository.new(system) }
  let(:entries) { Entry::Repository.new(system) }
  let(:annotations) { Annotation::Repository.new(system) }

  let!(:project_id) do
    projects.create(name: "Counts", created_by_email: "system@example.com", organization_id: 1)
  end
  let!(:dataset_id) do
    datasets.create(
      project_id:,
      name: "Counts",
      modality: "image",
      labels: [],
      labeling_configuration: { "image:box" => { values: [{ id: "car" }, { id: "person" }] } },
      workflow_configuration: {}
    )
  end
  let!(:assigned_entry_id) do
    entries.create(project_id:, dataset_id:, status: "pending", wf_step: "annotate", assigned_to_id: 4)
  end
  let!(:other_entry_id) do
    entries.create(project_id:, dataset_id:, status: "pending", wf_step: "annotate", assigned_to_id: 3)
  end

  before do
    members.create(
      project_id:,
      account_id: 3,
      role: "project_owner",
      email: "owner@example.com",
      invited_by_id: 1
    )
    members.create(
      project_id:,
      account_id: 4,
      role: "annotator",
      email: "annotator@example.com",
      invited_by_id: 1
    )

    [assigned_entry_id, other_entry_id, other_entry_id].each do |entry_id|
      annotations.create(
        project_id:,
        dataset_id:,
        entry_id:,
        category: "car",
        shape_type: "image:box",
        shape_args: {},
        created_by_email: "system@example.com"
      )
    end
  end

  it "returns only one visible entry's positive category rows", as: :annotator do
    service = Entry::Service.new(current_auth_context)

    rows = service.category_counts(assigned_entry_id)
    expect(rows.map { |row| [row.entry_id, row.category, row.count] }).to eq(
      [[assigned_entry_id, "car", 1]]
    )
    expect { service.category_counts(other_entry_id) }.to raise_error(Verse::Error::RecordNotFound)
  end

  it "sums the whole dataset for a project owner and includes configured zero categories", as: :project_owner do
    service = Dataset::Service.new(current_auth_context)

    totals = service.category_counts(dataset_id)
    expect(totals.map { |row| [row.category, row.annotation_count] }).to eq(
      [["car", 3], ["person", 0]]
    )
  end

  it "rejects dataset totals for an annotator with a visible entry", as: :annotator do
    service = Dataset::Service.new(current_auth_context)

    expect { service.category_counts(dataset_id) }.to raise_error(Verse::Error::Unauthorized)
  end

  it "returns counts for a reviewer's accessible unassigned review entry", as: :reviewer do
    members.create(
      project_id:,
      account_id: 5,
      role: "reviewer",
      email: "reviewer@example.com",
      invited_by_id: 1
    )
    review_entry_id = entries.create(
      project_id:,
      dataset_id:,
      status: "submitted",
      wf_step: "review",
      submitted_by_id: 4,
      assigned_to_id: nil
    )
    annotations.create(
      project_id:,
      dataset_id:,
      entry_id: review_entry_id,
      category: "person",
      shape_type: "image:box",
      shape_args: {},
      created_by_email: "system@example.com"
    )

    rows = Entry::Service.new(current_auth_context).category_counts(review_entry_id)
    expect(rows.map { |row| [row.category, row.count] }).to eq([["person", 1]])
  end

  it "filters visible entries by category count, treating missing rows as zero", as: :project_owner do
    service = Entry::Service.new(current_auth_context)

    expect(service.index({ category_count: { category: "car", count_gte: 2 } }).map(&:id)).to eq([other_entry_id])
    expect(service.index({ category_count: { category: "person", count_lte: 0 } }).map(&:id)).to contain_exactly(
      assigned_entry_id, other_entry_id
    )
    expect(service.index({ category_count: { category: "car", count_gte: 1, count_lte: 1 } }).map(&:id)).to eq(
      [assigned_entry_id]
    )
    expect(service.index({ category_count: { category: "person" } }).map(&:id)).to be_empty
  end

  it "combines dataset category conditions and honors zero thresholds", as: :project_owner do
    service = Dataset::Service.new(current_auth_context)

    expect(
      service.index(
        { category_counts: [
          { category: "car", min_annotations_per_entry: 2, entries_gte: 1, total_gte: 3 },
          { category: "person", entries_gte: 0, total_gte: 0 }
        ] }
      ).map(&:id)
    ).to eq([dataset_id])
    expect(service.index({ category_counts: { category: "person", entries_gte: 1 } }).map(&:id)).to be_empty
    expect(
      service.index(
        { category_counts: { category: "person", min_annotations_per_entry: 0,
                             entries_gte: 2 } }
      ).map(&:id)
    ).to eq([dataset_id])
  end

  it "rejects the full-dataset filter for an annotator", as: :annotator do
    service = Dataset::Service.new(current_auth_context)

    expect { service.index({ category_counts: { category: "car", total_gte: 1 } }) }
      .to raise_error(Verse::Error::Unauthorized)
  end

  it "rejects malformed count filters", as: :project_owner do
    expect { Entry::Service.new(current_auth_context).index({ category_count: "{bad" }) }
      .to raise_error(Verse::Error::ValidationFailed)
    expect { Dataset::Service.new(current_auth_context).index({ category_counts: { category: "car", total_gte: -1 } }) }
      .to raise_error(Verse::Error::ValidationFailed)
  end
end
