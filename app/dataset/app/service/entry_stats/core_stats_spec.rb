# frozen_string_literal: true

require "spec_helper"

RSpec.describe EntryStats::CoreStats do
  def make_entry(annotations: [], config: {})
    dataset = instance_double(Dataset::Record, labeling_configuration: config)
    instance_double(Entry::Record, dataset: dataset, annotations: annotations)
  end

  def make_annotation(category:, field: :category)
    instance_double(Annotation::Record, annotation: { field => category })
  end

  describe ".call" do
    it "returns zero annotation count and no category keys when there are no annotations" do
      expect(described_class.call(make_entry)).to eq("annotation.count" => "0")
    end

    context "with annotations and no labeling config" do
      it "counts annotations and emits data-driven categories" do
        annotations = [
          make_annotation(category: "cat"),
          make_annotation(category: "cat"),
          make_annotation(category: "dog")
        ]
        result = described_class.call(make_entry(annotations: annotations))

        expect(result["annotation.count"]).to eq("3")
        expect(result["category.cat.count"]).to eq("2")
        expect(result["category.dog.count"]).to eq("1")
      end

      it "skips annotations that have no category value" do
        annotations = [
          make_annotation(category: "cat"),
          instance_double(Annotation::Record, annotation: {})
        ]
        result = described_class.call(make_entry(annotations: annotations))

        expect(result["annotation.count"]).to eq("2")
        expect(result["category.cat.count"]).to eq("1")
      end
    end

    context "with configured category ids" do
      let(:config) do
        {
          "tool" => { values: [{ id: "cat" }, { id: "dog" }] }
        }
      end

      it "zero-fills configured categories when no annotations are present" do
        result = described_class.call(make_entry(config: config))

        expect(result["category.cat.count"]).to eq("0")
        expect(result["category.dog.count"]).to eq("0")
      end

      it "counts annotations against configured categories" do
        annotations = [
          make_annotation(category: "cat"),
          make_annotation(category: "cat")
        ]
        result = described_class.call(make_entry(annotations: annotations, config: config))

        expect(result["category.cat.count"]).to eq("2")
        expect(result["category.dog.count"]).to eq("0")
      end

      it "also emits categories that appear in annotations but are not in the config" do
        annotations = [make_annotation(category: "bird")]
        result = described_class.call(make_entry(annotations: annotations, config: config))

        expect(result["category.bird.count"]).to eq("1")
        expect(result["category.cat.count"]).to eq("0")
        expect(result["category.dog.count"]).to eq("0")
      end
    end

    context "with a custom category_field in the config" do
      let(:config) { { category_field: "label" } }

      it "reads the category from the specified field" do
        annotation = instance_double(Annotation::Record, annotation: { label: "cat" })
        result = described_class.call(make_entry(annotations: [annotation], config: config))

        expect(result["category.cat.count"]).to eq("1")
      end

      it "ignores annotations that use the default :category field instead" do
        annotation = instance_double(Annotation::Record, annotation: { category: "cat" })
        result = described_class.call(make_entry(annotations: [annotation], config: config))

        expect(result.keys.none? { |k| k.start_with?("category.") }).to be true
      end
    end
  end
end
