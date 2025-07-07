# frozen_string_literal: true

require "spec_helper"

RSpec.describe Video::GenerateStreaming do
  let(:file_path) {
    "spec_data/sample.mp4"
  }

  let(:arguments) do
    Video::Arguments.new(
      resource: "123",
      streaming_time_per_segment: 3
    )
  end

  let(:video_info) do
    Video::VideoInfo.from_file(file_path)
  end

  describe ".generate" do
    it "runs without errors" do
      described_class.call(file_path, video_info, arguments)
    end
  end
end
