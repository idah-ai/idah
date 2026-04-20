# fr

require "spec_helper"
require_relative "media"

RSpec.describe {{pluginModule}}::Media do
  describe ".init" do
    it "registers processor" do
      context = double("context")
      expect(context).to receive(:register_processor).with(
        "{{pluginName}}",
        class_name: "{{pluginModule}}::Processor",
        options_class_name: "{{pluginModule}}::Options"
      )

      described_class.init(context)
    end
  end
end
