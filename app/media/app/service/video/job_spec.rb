# frozen_string_literal: true

require "spec_helper"

RSpec.describe Video::Job, type: :service, database: true do
  let(:media_service){ Medias::Service.new(Verse::Auth::Context[:system]) }
  let(:media_repo){ Medias::Repository.new(Verse::Auth::Context[:system]) }

  let!(:media) do
    file = Rack::Test::UploadedFile.new(
      "spec_data/sample.mp4",
      "video/mp4"
    )

    media_service.upload(
      file,
      resource: "test",
      key: ""
    )
  end

  let(:job) do
    described_class.new(
      "job_id",
      {
        media_id: media.id,
        resource: "test"
      }
    )
  end

  it "should process the video" do
    job.run do
      # do nothing with the commands
    end

    # check that the media has been processed
    master_manifest = media_repo.find_by(
      {
        resource: "test",
        key: "master.m3u8"
      }
    )
    expect(master_manifest).to be_truthy

    stream_manifest = media_repo.find_by(
      {
        resource: "test",
        key: "240p.m3u8"
      }
    )
    expect(stream_manifest).to be_truthy

    fragment = media_repo.find_by(
      {
        resource: "test",
        key: "240p_0000.ts"
      }
    )
    expect(fragment).to be_truthy
  end
end
