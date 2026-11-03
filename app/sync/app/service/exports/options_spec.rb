# frozen_string_literal: true

RSpec.describe Exports::Options do
  subject { described_class }

  let(:schema) do
    Verse::Schema.define do
      field(:task, String).default("detect")
                          .meta(label: "Task", description: "What to label", choices: %w[detect segment])
      field(:val_percent, Integer).default(0).meta(label: "Validation videos (%)", min: 0, max: 50)
      field(:keyframes_only, TrueClass).default(false).meta(label: "Keyframes only")
      field(:scale, Float).default(1.0)
    end
  end

  describe ".describe" do
    it "lists each option with its type, default and display hints" do
      expect(subject.describe(schema)).to eq(
        [
          { name: "task", type: "string", default: "detect", required: false,
            label: "Task", description: "What to label",
            choices: [{ value: "detect", label: "detect" }, { value: "segment", label: "segment" }] },
          { name: "val_percent", type: "integer", default: 0, required: false,
            label: "Validation videos (%)", min: 0, max: 50 },
          { name: "keyframes_only", type: "boolean", default: false, required: false, label: "Keyframes only" },
          { name: "scale", type: "number", default: 1.0, required: false }
        ]
      )
    end

    it "keeps the label and info of each choice" do
      schema = Verse::Schema.define do
        field(:task, String).default("detect").meta(
          choices: [
            { value: "detect", label: "Detection (boxes)", info: "One box per object." },
            { value: "segment", label: "Segmentation (outlines)" }
          ]
        )
      end

      expect(subject.describe(schema).first[:choices]).to eq(
        [
          { value: "detect", label: "Detection (boxes)", info: "One box per object." },
          { value: "segment", label: "Segmentation (outlines)" }
        ]
      )
    end

    it "describes no options for an empty schema" do
      expect(subject.describe(Verse::Schema.empty)).to eq([])
    end
  end

  describe ".check!" do
    it "accepts the types the export dialog can show" do
      expect { subject.check!(schema) }.not_to raise_error
    end

    it "rejects a type the export dialog cannot show" do
      schema = Verse::Schema.define { field(:datasets, Array) }

      expect { subject.check!(schema) }.to raise_error(ArgumentError, /datasets/)
    end

    it "rejects a choice without a value" do
      schema = Verse::Schema.define { field(:task, String).meta(choices: [{ label: "Detection" }]) }

      expect { subject.check!(schema) }.to raise_error(ArgumentError, /task/)
    end

    it "rejects an option named like a general option" do
      schema = Verse::Schema.define { field(:include_medias, String) }

      expect { subject.check!(schema) }.to raise_error(ArgumentError, /include_medias/)
    end
  end

  describe ".validate!" do
    let(:general) { { include_medias: "none", completed_entries: true } }

    it "fills in the defaults of the exporter's options" do
      expect(subject.validate!(schema, general)).to eq(
        general.merge(task: "detect", val_percent: 0, keyframes_only: false, scale: 1.0)
      )
    end

    it "keeps and coerces the given values" do
      options = subject.validate!(schema, general.merge("task" => "segment", "val_percent" => "20"))

      expect(options).to include(task: "segment", val_percent: 20)
    end

    it "rejects a value outside the choices" do
      expect { subject.validate!(schema, general.merge(task: "pose")) }
        .to raise_error(Verse::Error::ValidationFailed) { |e| expect(e.source).to have_key(:"options.task") }
    end

    it "checks values against the values of described choices" do
      schema = Verse::Schema.define do
        field(:task, String).default("detect").meta(
          choices: [{ value: "detect", label: "Detection" }, { value: "obb", label: "Oriented boxes" }]
        )
      end

      expect(subject.validate!(schema, { task: "obb" })).to eq({ task: "obb" })
      expect { subject.validate!(schema, { task: "Oriented boxes" }) }
        .to raise_error(Verse::Error::ValidationFailed, /must be one of: detect, obb/)
    end

    it "rejects a number outside its bounds" do
      expect { subject.validate!(schema, general.merge(val_percent: 80)) }
        .to raise_error(Verse::Error::ValidationFailed) { |e| expect(e.source).to have_key(:"options.val_percent") }
    end

    it "rejects a value of the wrong type" do
      expect { subject.validate!(schema, general.merge(val_percent: "many")) }
        .to raise_error(Verse::Error::ValidationFailed)
    end

    it "rejects an option the exporter does not declare" do
      expect { subject.validate!(Verse::Schema.empty, general.merge(task: "segment")) }
        .to raise_error(Verse::Error::ValidationFailed) { |e| expect(e.source).to have_key(:"options.task") }
    end

    it "passes the general options through as they are" do
      expect(subject.validate!(Verse::Schema.empty, general)).to eq(general)
    end
  end
end
