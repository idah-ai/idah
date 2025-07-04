# frozen_string_literal: true

require "spec_helper"

RSpec.describe Video::GenerateStreaming do
  let(:file_path) { "spec_data/4k_sample.mp4" }

  let(:arguments) do
    Video::Arguments.new(
      media_id: "123",
      streaming_time_per_segment: 3
    )
  end

  describe ".generate" do
    it "runs without errors" do
      described_class.generate(file_path, arguments)
    end
  end
end
