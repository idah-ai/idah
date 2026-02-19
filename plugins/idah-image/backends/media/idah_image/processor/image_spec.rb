# frozen_string_literal: true

require "spec_helper"

RSpec.describe IdahImage::Processor::Image do
  let(:file_path) { "spec_data/sample.jpg" }
  let(:processor_context) do
    FakeProcessorContext.new(
      file_path: file_path,
      resource: "fake_resource_id"
    )
  end

  subject { described_class.new(processor_context) }

  it "process image" do
    # ensure the file exists in the fake setup or mock it
    allow(processor_context).to receive(:download_original).and_return(file_path)
    allow(File).to receive(:exist?).with(file_path).and_return(true)
    allow(File).to receive(:open).with(file_path, "rb").and_yield(StringIO.new("fake data"))
    allow(File).to receive(:delete).with(file_path)

    subject.run

    # it should upload the original image
    expect(processor_context.uploaded).to include(
      a_hash_including(
        key: "original.jpg",
        mime_type: "image/jpeg"
      )
    )

    # it should update the progress
    expect(processor_context.progress).to eq(1.0)
  end
end
