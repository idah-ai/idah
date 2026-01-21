require "spec_helper"

RSpec.describe Context::EnumerableContext do
  let(:context_items) do
    [
      double("Context1", name: :context1, respond_to?: true),
      double("Context2", name: :context2, respond_to?: true)
    ]
  end

  describe "#initialize" do
    context "with valid enumerable" do
      it "accepts an array of contexts" do
        instance = described_class.new(context_items)

        expect(instance.send(:__getobj__)).to eq(context_items)
      end
    end

    context "with non-enumerable object" do
      it "raises InvalidContext error" do
        non_enumerable = double("NotEnumerable")
        allow(non_enumerable).to receive(:respond_to?).with(:each).and_return(false)

        expect {
          described_class.new(non_enumerable)
        }.to raise_error(Context::Error::InvalidContext)
      end
    end

    context "validating context items" do
      it "raises error if item doesn't respond to name" do
        nameless_item = double("Nameless")
        allow(nameless_item).to receive(:respond_to?).with(:name).and_return(false)

        expect {
          described_class.new([nameless_item])
        }.to raise_error(Context::Error::InvalidContext)
      end

      it "validates all items in the collection" do
        valid_item = double("Valid", name: :valid)
        invalid_item = double("Invalid")
        allow(valid_item).to receive(:respond_to?).with(:name).and_return(true)
        allow(invalid_item).to receive(:respond_to?).with(:name).and_return(false)

        expect {
          described_class.new([valid_item, invalid_item])
        }.to raise_error(Context::Error::InvalidContext)
      end
    end

    it "passes args to super" do
      args = { test: { id: "123" } }
      instance = described_class.new(context_items, args)

      expect(instance.instance_variable_get(:@args)).to eq(args)
    end

    it "passes context_args to super" do
      context_args = { parent: { org_id: "org-1" } }
      instance = described_class.new(context_items, nil, context_args)

      expect(instance.instance_variable_get(:@context_args)).to eq(context_args)
    end

    it "passes opts to super" do
      opts = { page: { size: 50 } }
      instance = described_class.new(context_items, nil, nil, **opts)

      expect(instance.instance_variable_get(:@context_opts)).to eq(opts)
    end

    it "accepts context_builder block" do
      builder = proc { |result| result.map(&:upcase) }
      instance = described_class.new(context_items, nil, nil, &builder)

      expect(instance.instance_variable_get(:@context_builder)).to eq(builder)
    end
  end

  describe "Enumerable behavior" do
    let(:instance) { described_class.new(context_items) }

    it "includes Enumerable module" do
      expect(described_class.ancestors).to include(Enumerable)
    end
  end

  describe "#method_missing" do
    let(:instance) { described_class.new(context_items) }

    context "when method matches a context name" do
      it "returns the matching context" do
        result = instance.context1

        expect(result).to eq(context_items[0])
      end

      it "works with different context names" do
        result = instance.context2

        expect(result).to eq(context_items[1])
      end

      it "raise NoMethodError when no context matches" do
        expect{
          instance.nonexistent_context
        }.to raise_error NoMethodError
      end
    end

    context "when method doesn't match any context" do
      it "calls super for non-context methods" do
        expect {
          instance.unknown_method
        }.to raise_error(NoMethodError)
      end
    end
  end

  describe "#respond_to_missing?" do
    let(:instance) { described_class.new(context_items) }

    it "returns true for context names" do
      expect(instance.respond_to?(:context1)).to be true
      expect(instance.respond_to?(:context2)).to be true
    end

    it "returns false for non-existent contexts" do
      expect(instance.respond_to?(:nonexistent)).to be false
    end

    it "doesn't interfere with normal respond_to?" do
      # Should still respond to inherited methods
      expect(instance.respond_to?(:send)).to be true
    end
  end

  describe "real-world usage" do
    context "with multiple API contexts" do
      let(:organizations) { double("Organizations", name: :organizations) }
      let(:projects) { double("Projects", name: :projects) }
      let(:datasets) { double("Datasets", name: :datasets) }
      let(:contexts) { [organizations, projects, datasets] }
      let(:instance) { described_class.new(contexts) }

      it "provides access to each context by name" do
        expect(instance.organizations).to eq(organizations)
        expect(instance.projects).to eq(projects)
        expect(instance.datasets).to eq(datasets)
      end

      it "allows chaining context access" do
        allow(organizations).to receive(:projects).and_return(projects)

        # Could access like: instance.organizations.projects
        expect(instance.organizations.projects).to eq(projects)
      end
    end
  end

  describe "edge cases" do
    context "with empty array" do
      it "accepts empty enumerable" do
        instance = described_class.new([])

        expect(instance.send(:__getobj__)).to eq([])
      end
    end

    context "with single item" do
      let(:single_context) { double("Single", name: :single) }

      it "works with one context" do
        allow(single_context).to receive(:respond_to?).with(:name).and_return(true)
        instance = described_class.new([single_context])

        expect(instance.single).to eq(single_context)
      end
    end

    context "with duplicate names" do
      let(:dup1) { double("Dup1", name: :duplicate) }
      let(:dup2) { double("Dup2", name: :duplicate) }

      it "returns first match" do
        allow(dup1).to receive(:respond_to?).with(:name).and_return(true)
        allow(dup2).to receive(:respond_to?).with(:name).and_return(true)
        instance = described_class.new([dup1, dup2])

        expect(instance.duplicate).to eq(dup1)
      end
    end
  end
end
