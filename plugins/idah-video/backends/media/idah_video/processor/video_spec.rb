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
  let(:video_info) { double("video_info") }

  subject { described_class.new(processor_context) }

  before do
    allow(IdahVideo::Processor::VideoInfo).to receive(
      :from_file
    ).with(file_path).and_return(video_info)
    allow(IdahVideo::Processor::GenerateStreaming).to receive(
      :call
    ).and_yield(
      0.5,
      double(
        master_m3u8: "master.m3u8",
        streams: [
          double(
            m3u8: "stream1.m3u8",
            fragments: [
              "fragment1.ts", "fragment2.ts"
            ]
          )
        ]
      )
    )
    allow(IdahVideo::Processor::GenerateThumbnail).to receive(:call).and_yield("thumbnail.jpg")
    allow(processor_context).to receive(:arguments).and_return(
      double(
        generate_thumbnail: true,
        resource: "fake_resource_id"
      )
    )
    allow(Verse).to receive(:logger).and_return(Logger.new(IO::NULL))
  end

  it "process video" do
    subject.run

    # It should pass the correct arguments to GenerateStreaming
    expect(IdahVideo::Processor::GenerateStreaming).to have_received(:call).with(
      file_path, video_info, processor_context.arguments
    )

    # It should pass the correct arguments to GenerateThumbnail
    expect(IdahVideo::Processor::GenerateThumbnail).to have_received(:call).with(
      file_path, video_info, tmpdir: anything
    )

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
