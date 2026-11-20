# frozen_string_literal: true

require "spec_helper"

RSpec.describe "entry_category_counts", database: true do
  let(:system) { Verse::Auth::Context[:system] }
  let(:projects) { Project::Repository.new(system) }
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
      labeling_configuration: {},
      workflow_configuration: {}
    )
  end
  let!(:entry_id) do
    entries.create(project_id:, dataset_id:, status: "pending", wf_step: "start")
  end

  def add_annotation(category, entry: entry_id, deleted_at: nil)
    annotations.create(
      project_id:,
      dataset_id:,
      entry_id: entry,
      shape_type: "image:box",
      shape_args: {},
      category:,
      deleted_at:,
      created_by_email: "system@example.com"
    )
  end

  def category_counts(entry = entry_id)
    annotations.client do |db|
      db[:entry_category_counts].where(entry_id: entry).order(:category).all
    end
  end

  it "counts visible annotations once per entry and category" do
    add_annotation("car")
    add_annotation("car")
    add_annotation("person")
    add_annotation("car", deleted_at: Time.now.utc)

    expect(category_counts.map { |row| [row[:category], row[:count]] }).to eq(
      [["car", 2], ["person", 1]]
    )
    expect(category_counts.map { |row| row[:id] }.uniq.size).to eq(2)
  end

  it "moves counts on category change and ignores unrelated updates" do
    id = add_annotation("car")
    annotations.update!(id, { category: "person" })
    annotations.update!(id, { properties: { note: "unchanged category" } })

    expect(category_counts.map { |row| [row[:category], row[:count]] }).to eq([["person", 1]])
  end

  it "decrements on soft delete and increments on restore without zero rows" do
    id = add_annotation("car")
    annotations.update!(id, { deleted_at: Time.now.utc })
    expect(category_counts).to be_empty

    annotations.update!(id, { deleted_at: nil })
    expect(category_counts.map { |row| [row[:category], row[:count]] }).to eq([["car", 1]])
  end

  it "removes counts when an entry and its annotations are hard deleted" do
    add_annotation("car")
    entries.delete!(entry_id)

    expect(category_counts).to be_empty
  end

  it "backfills only visible annotations" do
    add_annotation("car")
    add_annotation("car", deleted_at: Time.now.utc)

    annotations.client do |db|
      db[:entry_category_counts].delete
      db.run(<<~SQL)
        INSERT INTO entry_category_counts (entry_id, dataset_id, project_id, category, count)
        SELECT entry_id, dataset_id, project_id, category, COUNT(*)::integer
        FROM annotations WHERE deleted_at IS NULL
        GROUP BY entry_id, dataset_id, project_id, category
      SQL
    end

    expect(category_counts.map { |row| [row[:category], row[:count]] }).to eq([["car", 1]])
  end

  it "removes counts when a dataset and its entries are hard deleted" do
    add_annotation("car")
    datasets.delete!(dataset_id)

    expect(category_counts).to be_empty
  end
end
