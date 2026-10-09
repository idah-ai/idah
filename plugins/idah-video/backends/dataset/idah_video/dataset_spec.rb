# frozen_string_literal: true

require "spec_helper"

RSpec.describe IdahVideo::Dataset do
  let(:context) { double("context") }

  describe ".init" do
    it "registers the stats generator for the idah-video modality" do
      expect(context).to receive(:register_stats_generator)
        .with("idah-video", IdahVideo::StatsGenerator)

      described_class.init(context)
    end
  end

  describe ".deinit" do
    it "unmounts the plugin" do
      expect(context).to receive(:unmount_plugin)

      described_class.deinit(context)
    end
  end
end
