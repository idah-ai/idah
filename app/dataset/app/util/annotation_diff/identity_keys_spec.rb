# frozen_string_literal: true

require "spec_helper"

module AnnotationDiff
  RSpec.describe IdentityKeys do
    # The parsed manifest has symbol keys at every level, including shape names
    # (:"bounding-box") and :"x-identity-key".
    def modality(id, shapes: nil, tagging: nil)
      { id:, shapes:, tagging: }.compact
    end

    def shape(label = "Bounding Box")
      { label:, icon: "icon.svg" }
    end

    describe ".from_modalities" do
      it "finds the identity keys of a shape in shapes" do
        modalities = [
          modality(
            "idah-video",
            shapes: { "bounding-box": shape.merge(
              args: { frames: { type: "array", "x-identity-key": "frame" } }
            ) }
          )
        ]

        expect(described_class.from_modalities(modalities, "idah-video:bounding-box")).to eq(
          { "frames" => "frame" }
        )
      end

      it "finds the identity keys of a shape in tagging" do
        modalities = [
          modality(
            "idah-video",
            tagging: { frame: shape.merge(
              args: { frames: { type: "array", "x-identity-key": "frame" } }
            ) }
          )
        ]

        expect(described_class.from_modalities(modalities, "idah-video:frame")).to eq(
          { "frames" => "frame" }
        )
      end

      it "returns {} for a shape without args" do
        modalities = [modality("idah-video", shapes: { "bounding-box": shape })]
        expect(described_class.from_modalities(modalities, "idah-video:bounding-box")).to eq({})
      end

      it "returns {} for an unknown shape" do
        modalities = [modality("idah-video", shapes: { "bounding-box": shape })]
        expect(described_class.from_modalities(modalities, "idah-video:circle")).to eq({})
      end

      it "returns {} for an unknown modality" do
        modalities = [modality("idah-video", shapes: { "bounding-box": shape })]
        expect(described_class.from_modalities(modalities, "entry:root")).to eq({})
      end

      it "returns {} for a type without a colon" do
        modalities = [modality("idah-video", shapes: { "bounding-box": shape })]
        expect(described_class.from_modalities(modalities, "bounding-box")).to eq({})
      end

      it "returns {} for nil" do
        modalities = [modality("idah-video", shapes: { "bounding-box": shape })]
        expect(described_class.from_modalities(modalities, nil)).to eq({})
      end

      it "finds shapes from both plugins when two modalities share an id" do
        modalities = [
          modality(
            "idah-video",
            shapes: { "bounding-box": shape.merge(
              args: { frames: { type: "array", "x-identity-key": "frame" } }
            ) }
          ),
          modality(
            "idah-video",
            shapes: { polygon: shape.merge(
              args: { frames: { type: "array", "x-identity-key": "frame" } }
            ) }
          )
        ]

        expect(described_class.from_modalities(modalities, "idah-video:polygon")).to eq(
          { "frames" => "frame" }
        )
      end

      it "reads every top-level args key that describes a keyed array" do
        modalities = [
          modality(
            "idah-video",
            shapes: { "bounding-box": shape.merge(
              args: {
                frames: { type: "array", "x-identity-key": "frame" },
                meshes: { type: "array", "x-identity-key" => "id" }
              }
            ) }
          )
        ]

        expect(described_class.from_modalities(modalities, "idah-video:bounding-box")).to eq(
          { "frames" => "frame", "meshes" => "id" }
        )
      end

      describe "malformed entries are ignored with a warning" do
        def warn_about
          allow(Verse.logger).to receive(:warn)
          yield
          expect(Verse.logger).to have_received(:warn).at_least(:once)
        end

        it "ignores an args entry that is not a Hash" do
          modalities = [
            modality(
              "idah-video",
              shapes: { "bounding-box": shape.merge(args: { frames: "not-a-hash" }) }
            )
          ]

          warn_about do
            expect(described_class.from_modalities(modalities, "idah-video:bounding-box")).to eq({})
          end
        end

        it "ignores an entry whose type is not array" do
          modalities = [
            modality(
              "idah-video",
              shapes: { "bounding-box": shape.merge(
                args: { frames: { type: "object", "x-identity-key": "frame" } }
              ) }
            )
          ]

          warn_about do
            expect(described_class.from_modalities(modalities, "idah-video:bounding-box")).to eq({})
          end
        end

        it "ignores a missing x-identity-key" do
          modalities = [
            modality(
              "idah-video",
              shapes: { "bounding-box": shape.merge(
                args: { frames: { type: "array" } }
              ) }
            )
          ]

          warn_about do
            expect(described_class.from_modalities(modalities, "idah-video:bounding-box")).to eq({})
          end
        end

        it "ignores an empty x-identity-key" do
          modalities = [
            modality(
              "idah-video",
              shapes: { "bounding-box": shape.merge(
                args: { frames: { type: "array", "x-identity-key": "" } }
              ) }
            )
          ]

          warn_about do
            expect(described_class.from_modalities(modalities, "idah-video:bounding-box")).to eq({})
          end
        end

        it "ignores a non-String x-identity-key" do
          modalities = [
            modality(
              "idah-video",
              shapes: { "bounding-box": shape.merge(
                args: { frames: { type: "array", "x-identity-key": :frame } }
              ) }
            )
          ]

          warn_about do
            expect(described_class.from_modalities(modalities, "idah-video:bounding-box")).to eq({})
          end
        end
      end
    end

    describe ".for", database: false do
      it "reads the loaded manifests of the repository's plugins" do
        expect(described_class.for("idah-video:bounding-box")).to eq({ "frames" => "frame" })
        expect(described_class.for("idah-video:polygon")).to eq({ "frames" => "frame" })
        expect(described_class.for("idah-video:frame")).to eq({ "frames" => "frame" })
      end

      it "returns {} for shapes with no declared args" do
        expect(described_class.for("idah-image:mask")).to eq({})
      end

      it "returns {} for a type no manifest declares" do
        expect(described_class.for("entry:root")).to eq({})
      end
    end
  end
end
