# frozen_string_literal: true

require "spec_helper"

RSpec.describe IdahVideo::Processor::Video do
  let(:processor_context) do
    FakeProcessorContext.new(
      file_path: "spec_data/sample.mp4",
      resource: "fake_resource_id"
    )
  end

  it "process video" do
  end
end
