# frozen_string_literal: true

require "spec_helper"
require "timeout"

RSpec.describe "entry category count concurrency" do
  let(:system) { Verse::Auth::Context[:system] }
  let(:projects) { Project::Repository.new(system) }
  let(:datasets) { Dataset::Repository.new(system) }
  let(:entries) { Entry::Repository.new(system) }
  let(:annotations) { Annotation::Repository.new(system) }

  before do
    @project_id = projects.create(
      name: "Concurrent counts",
      created_by_email: "system@example.com",
      organization_id: 1
    )
    @dataset_id = datasets.create(
      project_id: @project_id,
      name: "Concurrent counts",
      modality: "image",
      labels: [],
      labeling_configuration: {},
      workflow_configuration: {}
    )
    @entry_id = entries.create(
      project_id: @project_id,
      dataset_id: @dataset_id,
      status: "pending",
      wf_step: "start"
    )
  end

  after do
    projects.delete!(@project_id) if @project_id
  end

  it "serializes two inserts for the same entry and category" do
    first_inserted = Queue.new
    release_first = Queue.new
    attributes = {
      project_id: @project_id, dataset_id: @dataset_id, entry_id: @entry_id,
      category: "car", shape_type: "image:box", shape_args: Sequel.pg_jsonb({}),
      created_by_email: "system@example.com"
    }

    first = Thread.new do
      annotations.client do |db|
        db.transaction do
          db[:annotations].insert(attributes)
          first_inserted << true
          Timeout.timeout(5) { release_first.pop }
        end
      end
    end
    Timeout.timeout(5) { first_inserted.pop }
    second = Thread.new do
      annotations.client { |db| db[:annotations].insert(attributes) }
    end
    release_first << true
    first.value
    second.value

    rows = annotations.client do |db|
      db[:entry_category_counts].where(entry_id: @entry_id, category: "car").all
    end
    expect(rows.map { |row| row[:count] }).to eq([2])
  ensure
    release_first << true if release_first
    first&.join
    second&.join
  end
end
