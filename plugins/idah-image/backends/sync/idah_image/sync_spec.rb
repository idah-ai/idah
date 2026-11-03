# frozen_string_literal: true

require "spec_helper"
require_relative "sync"

RSpec.describe IdahImage::Sync do
  describe ".init" do
    it "registers the COCO, YOLO and mask segmentation exporters for image datasets" do
      context = double("context")
      expect(context).to receive(:register_exports).with("idah-image", IdahImage::Export::Coco::Exporter)
      expect(context).to receive(:register_exports).with("idah-image", IdahImage::Export::Yolo::Exporter)
      expect(context).to receive(:register_exports).with("idah-image", IdahImage::Export::Segmentation::Exporter)

      described_class.init(context)
    end
  end
end
