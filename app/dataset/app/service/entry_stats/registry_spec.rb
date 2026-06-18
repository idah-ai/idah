# frozen_string_literal: true

require "spec_helper"

RSpec.describe EntryStats::Registry do
  after { described_class.clear_all }

  let(:generator) do
    Class.new do
      def self.generate(_entry, _emit); end
    end
  end

  describe ".register / .get" do
    it "returns the registered generator for a modality" do
      described_class.register(:test_plugin, "test-modality", generator)
      expect(described_class.get("test-modality")).to eq generator
    end

    it "returns nil for an unregistered modality" do
      expect(described_class.get("unknown-modality")).to be_nil
    end

    it "tags the generator class with its plugin name" do
      described_class.register(:my_plugin, "test-modality", generator)
      expect(generator.plugin).to eq :my_plugin
    end

    it "raises when the same modality is registered twice" do
      described_class.register(:plugin_a, "test-modality", generator)

      expect {
        described_class.register(:plugin_b, "test-modality", Class.new)
      }.to raise_error(ArgumentError, /already registered/)
    end
  end

  describe ".clear" do
    it "removes only the generators belonging to the given plugin" do
      other_generator = Class.new
      described_class.register(:plugin_a, "modality-a", generator)
      described_class.register(:plugin_b, "modality-b", other_generator)

      described_class.clear(:plugin_a)

      expect(described_class.get("modality-a")).to be_nil
      expect(described_class.get("modality-b")).to eq other_generator
    end

    it "is a no-op when the plugin has no registrations" do
      expect { described_class.clear(:nonexistent) }.not_to raise_error
    end
  end

  describe ".clear_all" do
    it "removes all registered generators" do
      described_class.register(:plugin_a, "modality-a", generator)
      described_class.register(:plugin_b, "modality-b", Class.new)

      described_class.clear_all

      expect(described_class.get("modality-a")).to be_nil
      expect(described_class.get("modality-b")).to be_nil
    end
  end
end
