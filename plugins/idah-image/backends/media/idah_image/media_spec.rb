# frozen_string_literal: true

require "spec_helper"
require_relative "media"

RSpec.describe IdahImage::Media do
  describe ".init" do
    it "registers processor" do
      context = double("context")
      expect(context).to receive(:register_processor).with(
        "idah-image",
        class_name: "IdahImage::Processor::Image",
        options_class_name: "IdahImage::Processor::Options",
        mime_types: ["^image/.*$"]
      )

      described_class.init(context)
    end
  end
end
