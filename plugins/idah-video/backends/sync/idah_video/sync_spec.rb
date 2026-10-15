# frozen_string_literal: true

require "spec_helper"
require_relative "sync"

RSpec.describe IdahVideo::Sync do
  describe ".init" do
    it "registers the COCO and YOLO exporters for video datasets" do
      context = double("context")
      expect(context).to receive(:register_exports).with("idah-video", IdahVideo::Export::Coco::Exporter)
      expect(context).to receive(:register_exports).with("idah-video", IdahVideo::Export::Yolo::Exporter)

      described_class.init(context)
    end
  end
end
