# frozen_string_literal: true

require "spec_helper"

require_relative "../lib/plugin_system"
require_relative "../lib/plugin_system/system_shapes"

module PluginSystem
  RSpec.describe SystemShapes do
    # The parsed manifest has symbol keys at every level, including shape names
    # (:"done-area").
    def modality(id, system_shapes: nil)
      { id:, system_shapes: }.compact
    end

    describe ".from_modalities" do
      it "collects system shapes as modality_id:shape_name" do
        modalities = [
          modality("idah-image", system_shapes: { "done-area": { label: "Done Area" } })
        ]

        expect(described_class.from_modalities(modalities)).to eq(Set["idah-image:done-area"])
      end

      it "handles String shape-name keys" do
        modalities = [
          modality("idah-image", system_shapes: { "done-area" => { label: "Done Area" } })
        ]

        expect(described_class.from_modalities(modalities)).to eq(Set["idah-image:done-area"])
      end

      it "collects system shapes from several modalities" do
        modalities = [
          modality("idah-image", system_shapes: { "done-area": { label: "Done Area" } }),
          modality("idah-video", system_shapes: { playhead: { label: "Playhead" } })
        ]

        expect(described_class.from_modalities(modalities)).to eq(
          Set["idah-image:done-area", "idah-video:playhead"]
        )
      end

      it "returns an empty Set for modalities without systemShapes" do
        modalities = [modality("idah-image")]
        expect(described_class.from_modalities(modalities)).to eq(Set.new)
      end

      it "returns an empty Set for nil" do
        expect(described_class.from_modalities(nil)).to eq(Set.new)
      end

      it "skips modalities without an id" do
        modalities = [{ system_shapes: { "done-area": { label: "Done Area" } } }]
        expect(described_class.from_modalities(modalities)).to eq(Set.new)
      end

      it "ignores a non-Hash systemShapes value" do
        modalities = [modality("idah-image", system_shapes: "done-area")]
        expect(described_class.from_modalities(modalities)).to eq(Set.new)
      end
    end

    describe ".for_all" do
      it "reads the system shapes of the loaded plugins" do
        plugin = Struct.new(:modalities).new(
          [{ id: "idah-image", system_shapes: { "done-area": { label: "Done Area" } } }]
        )
        registry = Struct.new(:plugins).new({ "idah-image" => plugin, "unloaded" => nil })
        allow(PluginSystem).to receive(:registry).and_return(registry)

        expect(described_class.for_all).to eq(Set["idah-image:done-area"])
      end

      it "returns an empty Set when there is no registry" do
        allow(PluginSystem).to receive(:registry).and_return(nil)
        expect(described_class.for_all).to eq(Set.new)
      end
    end
  end
end
