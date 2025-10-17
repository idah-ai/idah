# frozen_string_literal: true

require "spec_helper"

RSpec.describe Processor::Registry do
  let(:processor_class) { Class.new }
  let(:processor_class2) { Class.new }

  around do |example|
    described_class.instance_variable_set(:@processors, {})
    example.run
  ensure
    described_class.instance_variable_set(:@processors, {})
  end

  describe ".register and .get" do
    it "registers a processor and allows to get it" do
      expect(described_class.get("my_processor")).to be_nil
      described_class.register("my_plugin", "my_processor", processor_class)
      expect(described_class.get("my_processor")).to eq(processor_class)
    end
  end

  describe ".clear" do
    before do
      described_class.register("plugin1", "processor1", processor_class)
      described_class.register("plugin2", "processor2", processor_class2)
    end

    it "clears only the processors of a specific plugin" do
      described_class.clear("plugin1")
      expect(described_class.get("processor1")).to be_nil
      expect(described_class.get("processor2")).to eq(processor_class2)
    end
  end

  it ".clear_all" do
    described_class.register("plugin1", "processor1", processor_class)
    described_class.register("plugin2", "processor2", processor_class2)

    described_class.clear_all
    expect(described_class.get("processor1")).to be_nil
    expect(described_class.get("processor2")).to be_nil
  end
end
