# frozen_string_literal: true

require "spec_helper"

RSpec.describe CategoryCounts::Aggregation do
  def dataset(id, label, category: "car")
    Dataset::Record.new(
      { id:, name: id, labeling_configuration: {
        "image:box" => { values: [{ id: category, label: }, { id: "zero", label: "Zero" }] }
      } }
    )
  end

  it "groups by category ID despite different labels, preserving distinct IDs and dataset counts" do
    datasets = [dataset("a", "Car"), dataset("b", "Vehicle"), dataset("c", "Car"),
                dataset("d", "Car", category: "automobile")]
    rows = described_class.dataset_rows(
      datasets,
      [
        { dataset_id: "a", category: "car", annotation_count: 30 },
        { dataset_id: "b", category: "car", annotation_count: 20 },
        { dataset_id: "c", category: "car", annotation_count: 10 },
        { dataset_id: "d", category: "automobile", annotation_count: 5 },
        { dataset_id: "a", category: "removed", annotation_count: 2 }
      ]
    )
    totals = described_class.project_rows("project", datasets, rows)

    expect(totals.map { |row| [row.category, row.label, row.annotation_count] })
      .to eq(
        [["car", "car", 60],
         ["automobile", "Car", 5], ["removed", "removed", 2], ["zero", "Zero", 0]]
      )
    expect(totals.first.datasets).to eq(
      [{ id: "a", name: "a", label: "Car", configured: true, annotation_count: 30 },
       { id: "b", name: "b", label: "Vehicle", configured: true, annotation_count: 20 },
       { id: "c", name: "c", label: "Car", configured: true, annotation_count: 10 }]
    )
    expect(totals.find { |row| row.category == "removed" }.configured).to be(false)
    expect(totals.sum(&:annotation_count)).to eq(67)
  end

  it "combines configured and unconfigured instances of the same category" do
    datasets = [dataset("a", "Car"), Dataset::Record.new({ id: "b", name: "b", labeling_configuration: {} })]
    rows = described_class.dataset_rows(
      datasets,
      [{ dataset_id: "a", category: "car", annotation_count: 2 },
       { dataset_id: "b", category: "car", annotation_count: 3 }]
    )
    car = described_class.project_rows("project", datasets, rows).find { |row| row.category == "car" }

    expect([car.label, car.annotation_count, car.configured]).to eq(["car", 5, true])
    expect(car.datasets).to eq(
      [{ id: "a", name: "a", label: "Car", configured: true, annotation_count: 2 },
       { id: "b", name: "b", label: "car", configured: false, annotation_count: 3 }]
    )
  end

  it "does not double count a category configured by multiple annotation tools" do
    record = dataset("a", "Car")
    record.labeling_configuration["image:polygon"] = { values: [{ id: "car", label: "Car" }] }
    rows = described_class.dataset_rows([record], [{ dataset_id: "a", category: "car", annotation_count: 3 }])
    expect(rows.select { |row| row.category == "car" }.map(&:annotation_count)).to eq([3])
  end

  it "handles missing configuration and uses stable, collision-safe aggregate IDs" do
    datasets = [Dataset::Record.new({ id: "a", name: "A", labeling_configuration: {} })]
    rows = described_class.dataset_rows(datasets, [{ dataset_id: "a", category: "x:y", annotation_count: 2 }])
    first = described_class.project_rows("project", datasets, rows)
    expect(first.first.label).to eq("x:y")
    expect(first.first.configured).to be(false)
    expect(described_class.project_rows("project", datasets, rows).map(&:id)).to eq(first.map(&:id))
    expect(described_class.project_rows("project", [], [])).to eq([])
  end
end
