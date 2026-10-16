# frozen_string_literal: true

require "spec_helper"
require_relative "sync"

RSpec.describe IdahVideo::Sync do
  describe ".init" do
    it "registers the COCO, YOLO and mask segmentation exporters for video datasets" do
      context = double("context")
      expect(context).to receive(:register_exports).with("idah-video", IdahVideo::Export::Coco::Exporter)
      expect(context).to receive(:register_exports).with("idah-video", IdahVideo::Export::Yolo::Exporter)
      expect(context).to receive(:register_exports).with("idah-video", IdahVideo::Export::Segmentation::Exporter)

      described_class.init(context)
    end
  end
end
