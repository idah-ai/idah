# frozen_string_literal: true

require "spec_helper"

RSpec.describe Plugin::Record, type: :model do
  let(:plugin_path) { "app/spec_data/fake_plugin" }

  describe ".from_path" do
    it "creates a record from a plugin path" do
      record = described_class.from_path(plugin_path)

      expect(record).to be_a(Plugin::Record)
      expect(record.source_type).to eq("manual")
      expect(record.source_path).to include(plugin_path)
      expect(record.name).to eq("idah-video")
      expect(record.description).to eq("A module for annotating video.")
      expect(record.version).to eq("1.0.0")
    end
  end

  describe "#path" do
    context "when source_type is manual" do
      let(:record) do
        described_class.new({
          source_type: "manual",
          source_path: "/custom/path/to/plugin"
        })
      end

      it "returns the source_path" do
        expect(record.path).to eq("/custom/path/to/plugin")
      end
    end

    context "when source_type is not manual" do
      let(:record) do
        described_class.new({
          source_type: "remote",
          name: "my-plugin",
          version: "1.2.3"
        })
      end

      it "builds the path from plugin configuration" do
        allow(Verse.config.extra_fields).to receive(:dig).with(
          :idah, :plugins, :path
        ).and_return("all_plugins")

        expect(record.path).to eq("all_plugins/my-plugin-1.2.3")
      end

      it "builds the path with default plugins directory" do
        expect(record.path).to eq("plugins/my-plugin-1.2.3")
      end
    end
  end

  describe "#manifest" do
    let(:record) { described_class.from_path(plugin_path) }

    it "loads the manifest from the plugin path" do
      manifest = record.manifest

      expect(manifest).to be_a(PluginSystem::Manifest)
      expect(manifest.name).to eq("idah-video")
      expect(manifest.version).to eq("1.0.0")
    end

    it "returns nil if manifest.json does not exist" do
      allow(File).to receive(:exist?).and_return(false)

      # Clear memoized @manifest
      record.instance_variable_set(:@manifest, nil)

      expect(record.manifest).to be_nil
    end
  end
end
