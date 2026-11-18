# frozen_string_literal: true

require "spec_helper"

RSpec.describe Workflow::Registry do
  after { described_class.clear_all }

  let(:workflow_class) do
    Class.new do
      def self.definition
        {
          name: "test-workflow",
          label: "Test Workflow",
          steps: [{ name: "start", label: "Start" }]
        }
      end
    end
  end

  let(:other_workflow_class) do
    Class.new do
      def self.definition
        {
          name: "other-workflow",
          label: "Other Workflow",
          steps: [{ name: "start", label: "Start" }]
        }
      end
    end
  end

  describe "#register" do
    it "registers a workflow class under the given plugin and name" do
      described_class.register(:my_plugin, "my-workflow", klass: workflow_class)
      expect(described_class.get("my-workflow")).to eq workflow_class
    end

    it "converts plugin name to a symbol" do
      described_class.register("string_plugin", "wf", klass: workflow_class)
      expect(described_class.get("wf")).to eq workflow_class
    end

    it "converts workflow name to a symbol internally" do
      described_class.register(:plugin, "string-name", klass: workflow_class)
      expect(described_class.get("string-name")).to eq workflow_class
    end

    it "appends to the list when registering a second workflow under the same name" do
      described_class.register(:plugin_a, "shared", klass: workflow_class)
      described_class.register(:plugin_b, "shared", klass: other_workflow_class)

      workflows = described_class.list
      expect(workflows[:shared].size).to eq 2
    end
  end

  describe "#get" do
    it "returns SimpleReviewAnnotationWorkflow for nil name" do
      expect(described_class.get(nil)).to eq Workflow::SimpleReviewAnnotationWorkflow
    end

    it "returns SimpleReviewAnnotationWorkflow for 'default' name" do
      expect(described_class.get("default")).to eq Workflow::SimpleReviewAnnotationWorkflow
    end

    it "returns SimpleReviewAnnotationWorkflow for an unregistered workflow name" do
      expect(described_class.get("nonexistent")).to eq Workflow::SimpleReviewAnnotationWorkflow
    end

    it "returns the first registered class when multiple are registered under the same name" do
      described_class.register(:plugin_a, "multi", klass: workflow_class)
      described_class.register(:plugin_b, "multi", klass: other_workflow_class)

      expect(described_class.get("multi")).to eq workflow_class
    end

    it "returns the registered class for a symbol name" do
      described_class.register(:plugin, "test_wf", klass: workflow_class)
      expect(described_class.get(:test_wf)).to eq workflow_class
    end
  end

  describe "#list" do
    it "returns the internal workflows hash" do
      described_class.register(:plugin, "wf_a", klass: workflow_class)
      described_class.register(:plugin, "wf_b", klass: other_workflow_class)

      result = described_class.list
      expect(result).to be_a(Hash)
      expect(result.keys).to contain_exactly(:wf_a, :wf_b)
    end

    it "returns an empty hash when no workflows are registered" do
      expect(described_class.list).to eq({})
    end

    it "groups entries by workflow name" do
      described_class.register(:plugin_a, "shared", klass: workflow_class)
      described_class.register(:plugin_b, "shared", klass: other_workflow_class)

      entries = described_class.list[:shared]
      expect(entries.size).to eq 2
      expect(entries.map(&:plugin)).to contain_exactly(:plugin_a, :plugin_b)
    end
  end

  describe "#clear" do
    it "removes only the entries belonging to the given plugin" do
      described_class.register(:plugin_a, "wf-a", klass: workflow_class)
      described_class.register(:plugin_b, "wf-b", klass: other_workflow_class)

      described_class.clear(:plugin_a)

      expect(described_class.get("wf-a")).to eq Workflow::SimpleReviewAnnotationWorkflow
      expect(described_class.get("wf-b")).to eq other_workflow_class
    end

    it "removes the workflow entry from the list when the only entry for that name is removed" do
      described_class.register(:plugin_a, "solo", klass: workflow_class)
      described_class.clear(:plugin_a)

      expect(described_class.list).not_to have_key(:solo)
    end

    it "preserves the workflow name in the list when other entries remain" do
      described_class.register(:plugin_a, "shared", klass: workflow_class)
      described_class.register(:plugin_b, "shared", klass: other_workflow_class)

      described_class.clear(:plugin_a)

      expect(described_class.list[:shared].size).to eq 1
      expect(described_class.list[:shared].first.plugin).to eq :plugin_b
    end

    it "is a no-op when the plugin has no registrations" do
      expect { described_class.clear(:nonexistent) }.not_to raise_error
    end

    it "converts plugin name to a symbol" do
      described_class.register(:my_plugin, "wf", klass: workflow_class)
      described_class.clear("my_plugin")
      expect(described_class.get("wf")).to eq Workflow::SimpleReviewAnnotationWorkflow
    end
  end

  describe "#clear_all" do
    it "removes all registered workflows" do
      described_class.register(:plugin_a, "wf-a", klass: workflow_class)
      described_class.register(:plugin_b, "wf-b", klass: other_workflow_class)

      described_class.clear_all

      expect(described_class.list).to eq({})
      expect(described_class.get("wf-a")).to eq Workflow::SimpleReviewAnnotationWorkflow
    end
  end

  describe "#definitions" do
    it "includes the default workflow definition" do
      definitions = described_class.definitions

      default = definitions.find { |d| d[:name] == :default }
      expect(default).not_to be_nil
      expect(default[:plugin]).to eq :core
      expect(default[:definition]).to eq Workflow::SimpleReviewAnnotationWorkflow.definition
    end

    it "includes registered plugin workflow definitions" do
      described_class.register(:my_plugin, "custom_wf", klass: workflow_class)

      definitions = described_class.definitions

      custom = definitions.find { |d| d[:name] == :custom_wf }
      expect(custom).not_to be_nil
      expect(custom[:plugin]).to eq :my_plugin
      expect(custom[:definition]).to eq workflow_class.definition
    end

    it "returns only the first entry when multiple plugins register the same workflow name" do
      described_class.register(:plugin_a, "shared", klass: workflow_class)
      described_class.register(:plugin_b, "shared", klass: other_workflow_class)

      definitions = described_class.definitions

      shared = definitions.select { |d| d[:name] == :shared }
      expect(shared.size).to eq 1
      expect(shared.first[:plugin]).to eq :plugin_a
    end

    it "returns definitions in order: defaults first, then plugin workflows" do
      described_class.register(:a_plugin, "a_wf", klass: workflow_class)
      described_class.register(:z_plugin, "z_wf", klass: other_workflow_class)

      definitions = described_class.definitions

      expect(definitions.first[:name]).to eq :default
      expect(definitions.last[:name]).to eq :z_wf
    end

    it "returns only default definitions when no plugins are registered" do
      definitions = described_class.definitions
      expect(definitions.size).to eq 1
      expect(definitions.first[:name]).to eq :default
    end
  end
end
