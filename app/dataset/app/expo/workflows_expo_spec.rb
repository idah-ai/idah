# frozen_string_literal: true

require "spec_helper"

RSpec.describe WorkflowsExpo, type: :exposition, as: :system do
  # Register a test workflow so the test doesn't depend on plugins being loaded
  let(:test_definition) do
    Class.new do
      def self.name = "test-external-workflow"
      def self.label = "Test External Workflow"
      def self.description = "A test workflow with external steps"
      def self.steps = []
      def self.allowed_note_feed = %w[annotate review]
      def self.external_steps = %w[external_step]
    end
  end

  let(:test_workflow_class) do
    definition = test_definition
    Class.new(Workflow::Base) do
      aasm do
        state :start, initial: true
        state :external_step
      end

      define_singleton_method(:definition) { definition }
    end
  end

  before do
    Workflow::Registry.register(:test, "test-external-workflow", klass: test_workflow_class)
  end

  after do
    Workflow::Registry.clear(:test)
  end

  it "returns a list of workflows with external_steps" do
    get "/workflows"

    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)

    workflows = body[:data][:workflows]
    expect(workflows).to be_an(Array)
    expect(workflows.length).to be >= 2 # default + test

    test_workflow = workflows.find { |w| w[:name] == "test-external-workflow" }
    expect(test_workflow).not_to be_nil
    expect(test_workflow[:external_steps]).to eq(["external_step"])

    default = workflows.find { |w| w[:name] == "default" }
    if default
      expect(default[:external_steps]).to eq([])
    end
  end
end