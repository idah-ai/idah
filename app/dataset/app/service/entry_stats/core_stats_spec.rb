# frozen_string_literal: true

require "spec_helper"

RSpec.describe EntryStats::CoreStats do
  def make_entry(annotations: [], config: {})
    dataset = instance_double(Dataset::Record, labeling_configuration: config)
    instance_double(Entry::Record, dataset: dataset, annotations: annotations)
  end

  def make_annotation(category:, type: nil, deleted: false)
    instance_double(
      Annotation::Record,
      category: category,
      shape_type: type,
      deleted_at: deleted ? Time.now.utc : nil
    )
  end

  describe ".call" do
    it "returns zero annotation count and no category keys when there are no annotations" do
      expect(described_class.call(make_entry)).to eq("annotation.count" => "0")
    end

    context "with annotations and no labeling config" do
      it "counts annotations without category stats" do
        annotations = [
          make_annotation(category: "cat"),
          make_annotation(category: "cat"),
          make_annotation(category: "dog")
        ]
        result = described_class.call(make_entry(annotations: annotations))

        expect(result["annotation.count"]).to eq("3")
        expect(result.keys.grep(/^category\./)).to be_empty
      end

      it "skips annotations that have no category value" do
        annotations = [
          make_annotation(category: "cat"),
          instance_double(Annotation::Record, category: nil, shape_type: nil, deleted_at: nil)
        ]
        result = described_class.call(make_entry(annotations: annotations))

        expect(result["annotation.count"]).to eq("2")
        expect(result.keys.grep(/^category\./)).to be_empty
      end
    end

    context "with shape dimensions" do
      it "counts annotations by shape type, stripping the modality prefix" do
        annotations = [
          make_annotation(category: "cat", type: "idah-video:bounding-box"),
          make_annotation(category: "dog", type: "idah-video:bounding-box"),
          make_annotation(category: "cat", type: "idah-video:polygon")
        ]
        result = described_class.call(make_entry(annotations: annotations))

        expect(result["shape.bounding-box.count"]).to eq("2")
        expect(result["shape.polygon.count"]).to eq("1")
      end

      it "keeps the type as-is when there is no modality prefix" do
        annotations = [make_annotation(category: "cat", type: "bounding-box")]
        result = described_class.call(make_entry(annotations: annotations))

        expect(result["shape.bounding-box.count"]).to eq("1")
      end

      it "emits no shape keys when annotations have no dimensions" do
        annotations = [make_annotation(category: "cat")]
        result = described_class.call(make_entry(annotations: annotations))

        expect(result.keys.none? { |k| k.start_with?("shape.") }).to be true
      end

      it "zero-fills shape types from tool-type config keys" do
        config = { "idah-video:bounding-box" => {}, "idah-video:polygon" => {} }
        annotations = [make_annotation(category: "cat", type: "idah-video:bounding-box")]
        result = described_class.call(make_entry(annotations: annotations, config: config))

        expect(result["shape.bounding-box.count"]).to eq("1")
        expect(result["shape.polygon.count"]).to eq("0")
      end
    end

    context "with soft-deleted annotations" do
      it "excludes deleted annotations from all counts" do
        annotations = [
          make_annotation(category: "cat", type: "idah-video:bounding-box"),
          make_annotation(category: "dog", type: "idah-video:polygon", deleted: true)
        ]
        result = described_class.call(make_entry(annotations: annotations))

        expect(result["annotation.count"]).to eq("1")
        expect(result.keys.grep(/^category\./)).to be_empty
        expect(result["shape.bounding-box.count"]).to eq("1")
        expect(result["shape.polygon.count"]).to be_nil
      end
    end
  end
end
