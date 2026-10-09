# frozen_string_literal: true

require "spec_helper"

RSpec.describe IdahVideo::StatsGenerator do
  let(:entry) { double("entry", id: "entry-1", resource: "media://video-1") }
  let(:medias) { double("medias") }
  let(:logger) { instance_double(Logger, warn: nil) }
  let(:emitted) { {} }
  let(:emit) { ->(key, value) { emitted[key] = value } }

  before do
    stub_const("Api", { idah: double("api", media: double("media", medias:)) })
    allow(Verse).to receive(:logger).and_return(logger)
  end

  def media_info(meta)
    double("response", data: { attributes: { meta: } })
  end

  describe ".generate" do
    it "emits the duration, fps and frame count of the original upload" do
      allow(medias).to receive(:resource_info)
        .with(resource: "media://video-1")
        .and_return(media_info({ duration: 10.5, fps: 24.0 }))

      described_class.generate(entry, emit)

      expect(emitted).to eq(
        "video.duration_seconds" => 10.5,
        "video.fps" => 24.0,
        "video.frame_count" => 252
      )
    end

    it "rounds the frame count to the nearest frame" do
      allow(medias).to receive(:resource_info)
        .and_return(media_info({ duration: "1.01", fps: "29.97" }))

      described_class.generate(entry, emit)

      expect(emitted["video.duration_seconds"]).to eq(1.01)
      expect(emitted["video.fps"]).to eq(29.97)
      expect(emitted["video.frame_count"]).to eq(30)
    end

    it "emits nothing when the media has no metadata yet" do
      allow(medias).to receive(:resource_info).and_return(media_info({}))

      described_class.generate(entry, emit)

      expect(emitted).to be_empty
      expect(logger).not_to have_received(:warn)
    end

    it "logs and emits nothing when the media service fails" do
      allow(medias).to receive(:resource_info).and_raise(StandardError, "connection refused")

      expect { described_class.generate(entry, emit) }.not_to raise_error

      expect(emitted).to be_empty
      expect(logger).to have_received(:warn).with(
        a_string_including("entry entry-1", "StandardError", "connection refused")
      )
    end

    it "logs and emits nothing when the media has no metadata field" do
      allow(medias).to receive(:resource_info).and_return(media_info(nil))

      described_class.generate(entry, emit)

      expect(emitted).to be_empty
      expect(logger).to have_received(:warn)
    end
  end
end
