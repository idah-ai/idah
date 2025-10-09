# frozen_string_literal: true

require "spec_helper"

RSpec.describe Video::VideoInfo do
  let(:file_path) { "spec_data/sample.mp4" }

  describe ".from_file" do
    context "with a valid video file" do
      it "returns a VideoInfo object with correct attributes" do
        video_info = described_class.from_file(file_path)

        expect(video_info.width).to eq(480)
        expect(video_info.height).to eq(270)
        expect(video_info.duration).to be_within(0.1).of(30.52)
        expect(video_info.fps).to be_within(0.1).of(30)
      end

      it "calculates the ratio correctly" do
        video_info = described_class.from_file(file_path)
        expect(video_info.ratio).to eq(480.0 / 270.0)
      end
    end

    context "with an invalid video file" do
      let(:file_path) { "spec_data/repository_helper.rb" }

      it "raises an error" do
        expect do
          described_class.from_file(file_path)
        end.to raise_error(/Failed to execute ffprobe/)
      end
    end
  end
end
