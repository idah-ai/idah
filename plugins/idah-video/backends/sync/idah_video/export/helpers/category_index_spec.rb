# frozen_string_literal: true

require "spec_helper"

RSpec.describe IdahVideo::Export::Helpers::CategoryIndex do
  subject(:index) { described_class.new }

  let(:configuration) do
    {
      "idah-video:bounding-box": {
        values: [
          { id: "human/civilian/armed", label: "armed", parent: "human/civilian" },
          { id: "human/military/armed", label: "armed", parent: "human/military" },
          { id: "human/military/-", label: " ", parent: "human/military" }
        ]
      },
      "idah-video:polygon": {
        values: [{ id: "road", label: "Road" },
                 { id: "human/civilian/armed", label: "armed", parent: "human/civilian" }]
      },
      "idah-video:frame": { values: [{ id: "night", label: "Night" }] },
      "entry:root": { values: [{ id: "rain", label: "Rain" }] }
    }
  end

  before { index.add_configuration(configuration) }

  describe "#color_for" do
    let(:configuration) do
      {
        "idah-video:bounding-box": { values: [{ id: "car", color: "#009687" }, { id: "boat" }] },
        "idah-video:polygon": { values: [{ id: "car", color: "#EB1461" }] }
      }
    end

    it "gives a category's configured colour, the first when configured twice" do
      expect([index.color_for("car"), index.color_for("boat"), index.color_for("other")]).to eq(["#009687", nil, nil])
    end
  end

  describe "#categories" do
    it "names box and polygon categories by their id, once each, in configuration order, from id 1" do
      expect(index.categories).to eq(
        [
          { id: 1, name: "human/civilian/armed", supercategory: "human/civilian" },
          { id: 2, name: "human/military/armed", supercategory: "human/military" },
          { id: 3, name: "human/military/-", supercategory: "human/military" },
          { id: 4, name: "road", supercategory: "" }
        ]
      )
    end

    it "keeps ids stable when a second dataset repeats categories" do
      index.add_configuration(
        { "idah-video:bounding-box" => { "values" => [{ "id" => "bike", "label" => "Bike" },
                                                      { "id" => "road", "label" => "Road" }] } }
      )

      expect(index.categories.map { |c| [c[:id], c[:name]] }).to eq(
        [[1, "human/civilian/armed"], [2, "human/military/armed"], [3, "human/military/-"], [4, "road"], [5, "bike"]]
      )
    end

    it "takes the supercategory from the id path when the value has no parent" do
      index.add_configuration({ "idah-video:bounding-box": { values: [{ id: "animals/dog", label: "Dog" }] } })

      expect(index.categories.last).to eq({ id: 5, name: "animals/dog", supercategory: "animals" })
    end
  end

  describe "#id_for" do
    it "returns the COCO id of a category" do
      expect(index.id_for("human/military/armed")).to eq(2)
    end

    it "adds a category missing from the configuration" do
      expect(index.id_for("animals/dog")).to eq(5)
      expect(index.categories.last).to eq({ id: 5, name: "animals/dog", supercategory: "animals" })
    end
  end
end
