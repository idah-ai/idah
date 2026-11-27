# frozen_string_literal: true

require "spec_helper"

RSpec.describe Entry::Service, database: true do
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

  it "rejects malformed entry count filters", as: :project_owner do
    expect { Entry::Service.new(current_auth_context).index({ category_count: "{bad" }) }
      .to raise_error(Verse::Error::ValidationFailed)
  end
end
