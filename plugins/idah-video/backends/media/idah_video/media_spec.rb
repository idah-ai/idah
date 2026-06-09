# frozen_string_literal: true

require "spec_helper"
require_relative "media"

RSpec.describe IdahVideo::Media do
  describe ".init" do
    it "registers processor" do
      context = double("context")
      expect(context).to receive(:register_processor).with(
        "idah-video",
        class_name: "IdahVideo::Processor::Video",
        options_class_name: "IdahVideo::Processor::Options"
      )

      described_class.init(context)
    end
  end
end
