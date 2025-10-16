# frozen_string_literal: true

require "spec_helper"

RSpec.describe IdahVideo::Processor::Video do
  let(:file_path) { "spec_data/sample.mp4" }
  let(:processor_context) do
    FakeProcessorContext.new(
      file_path: file_path,
      resource: "fake_resource_id"
    )
  end

  subject { described_class.new(processor_context) }

  it "process video" do
    subject.run

    # It should upload the master manifest
    expect(processor_context.uploaded).to include(
      a_hash_including(
        key: "master.m3u8",
        mime_type: "application/vnd.apple.mpegurl"
      )
    )

    # It should upload the different streams manifests
    expect(processor_context.uploaded).to include(
      a_hash_including(
        key: "stream1.m3u8",
        mime_type: "application/vnd.apple.mpegurl"
      )
    )

    # It should upload the stream fragments
    expect(processor_context.uploaded).to include(
      a_hash_including(
        key: "fragment1.ts",
        mime_type: "video/mp2t"
      )
    )
    expect(processor_context.uploaded).to include(
      a_hash_including(
        key: "fragment2.ts",
        mime_type: "video/mp2t"
      )
    )

    # It should upload the thumbnail
    expect(processor_context.uploaded).to include(
      a_hash_including(
        key: "thumbnail.jpg",
        mime_type: "image/jpeg"
      )
    )

    # It should update the progress
    expect(processor_context.progress).to eq(0.495) # 0.5 * 0.99
  end
end
