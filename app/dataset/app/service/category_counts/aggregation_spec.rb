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

  it "groups by ID and label, preserving different IDs with identical labels and counting each annotation once" do
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

    expect(totals.map { |row| [row.category, row.label, row.annotation_count, row.label_conflict] })
      .to eq(
        [["car", "Car", 40, true], ["car", "Vehicle", 20, true],
         ["automobile", "Car", 5, false], ["removed", "removed", 2, false], ["zero", "Zero", 0, false]]
      )
    expect(totals.first.datasets).to eq([{ id: "a", name: "a" }, { id: "c", name: "c" }])
    expect(totals.find { |row| row.category == "removed" }.configured).to be(false)
    expect(totals.sum(&:annotation_count)).to eq(67)
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
