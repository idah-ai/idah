# frozen_string_literal: true

require "spec_helper"

RSpec.describe Dataset::Service, database: true do
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

  it "rejects malformed dataset count filters", as: :project_owner do
    expect { Dataset::Service.new(current_auth_context).index({ category_counts: { category: "car", total_gte: -1 } }) }
      .to raise_error(Verse::Error::ValidationFailed)
  end
end
