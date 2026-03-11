# frozen_string_literal: true

require "spec_helper"
require_relative "{{pluginRubyFilename}}"

RSpec.describe {{pluginModule}}::Sync do
  describe ".init" do
    it "registers exports" do
      context = double("context")
      expect(context).to receive(:register_exports).with(
        "{{pluginName}}",
        {{pluginModule}}::Export
      )

      described_class.init(context)
    end
  end
end
