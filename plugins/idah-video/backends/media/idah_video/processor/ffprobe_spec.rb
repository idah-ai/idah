# frozen_string_literal: true

require "spec_helper"

RSpec.describe IdahVideo::Processor::Ffprobe do
  let(:file_path) { "spec_data/sample.mp4" }

  describe ".identity" do
    context "with a valid video file" do
      it "returns a hash with video information" do
        info = described_class.identity(file_path)

        expect(info).to be_a(Hash)
        expect(info).to have_key(:streams)
        expect(info).to have_key(:format)
      end
    end

    context "with an invalid file" do
      let(:file_path) { "spec_data/repository_helper.rb" }

      it "raises an error" do
        expect do
          described_class.identity(file_path)
        end.to raise_error(/Failed to execute ffprobe/)
      end
    end
  end
end
