# frozen_string_literal: true

require "spec_helper"
require_relative "sync"

RSpec.describe IdahImage::Sync do
  describe ".init" do
    it "registers the COCO exporter for image datasets" do
      context = double("context")
      expect(context).to receive(:register_exports).with("idah-image", IdahImage::Export::Coco::Exporter)

      described_class.init(context)
    end
  end
end
