# frozen_string_literal: true

require "spec_helper"

RSpec.describe PluginLifecycleContext do
  subject(:context) { described_class.new(plugin_name) }

  let(:plugin_name) { "test_plugin" }

  # Dummy class for testing
  # rubocop:disable Lint/ConstantDefinitionInBlock
  class TestExporter
  end
  # rubocop:enable Lint/ConstantDefinitionInBlock

  describe "#initialize" do
    it "initializes with a plugin name" do
      expect { described_class.new("my_plugin") }.not_to raise_error
    end

    it "converts plugin name to symbol" do
      context = described_class.new("string_plugin")
      expect(context.instance_variable_get(:@plugin_name)).to eq(:string_plugin)
    end

    it "handles symbol plugin names" do
      context = described_class.new(:symbol_plugin)
      expect(context.instance_variable_get(:@plugin_name)).to eq(:symbol_plugin)
    end
  end

  describe "#register_exports" do
    let(:modalities) { "image" }
    let(:klass) { TestExporter }

    it "delegates to Exports::Registry.register with plugin_name, modalities, and class" do
      expect(Exports::Registry).to receive(:register).with(
        :test_plugin,
        modalities,
        klass
      )

      context.register_exports(modalities, klass)
    end

    it "passes modalities as-is to Registry" do
      expect(Exports::Registry).to receive(:register).with(
        :test_plugin,
        ["image", "video"],
        klass
      )

      context.register_exports(["image", "video"], klass)
    end

    it "passes regex modalities to Registry" do
      regex_pattern = %r{image/.*}

      expect(Exports::Registry).to receive(:register).with(
        :test_plugin,
        regex_pattern,
        klass
      )

      context.register_exports(regex_pattern, klass)
    end
  end

  describe "#mount_plugin" do
    it "accepts a plugin name parameter" do
      expect { context.mount_plugin("another_plugin") }.not_to raise_error
    end

    it "does nothing (no-op method)" do
      # This method is intentionally empty, just verify it doesn't error
      expect(context.mount_plugin("another_plugin")).to be_nil
    end
  end

  describe "#unmount_plugin" do
    it "delegates to Exports::Registry.clear with plugin_name" do
      expect(Exports::Registry).to receive(:clear).with(:test_plugin)

      context.unmount_plugin
    end
  end
end
