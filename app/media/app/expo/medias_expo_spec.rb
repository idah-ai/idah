# frozen_string_literal: true

RSpec.describe MediasExpo, type: :exposition, as: :system do
  let(:now) { Time.now.utc }

  let(:media) do
    Medias::Record.new(
      {
        id: 1,
        resource: "some-resource",
        key: "some-key",
        file_data: "{}",
        filename: "sample.mp4",
        size: 2,
        mime_type: "video/mp4",
        created_role: "system",
        created_by: nil,
        created_at: now,
        updated_at: now
      }
    )
  end

  context "#info" do
    it "without key" do
      expect_any_instance_of(Medias::Service).to receive(:show).with(
        "some-resource", ""
      ).and_return(media)

      get "/medias/info/some-resource"
      expect(last_response.status).to eq 200
      body = JSON.parse(last_response.body, symbolize_names: true)
      expect(body[:data]).not_to be_empty
    end

    it "with key" do
      expect_any_instance_of(Medias::Service).to receive(:show).with(
        "some-resource", "some-key"
      ).and_return(media)

      get "/medias/info/some-resource/some-key"

      expect(last_response.status).to eq 200
      body = JSON.parse(last_response.body, symbolize_names: true)
      expect(body[:data]).not_to be_empty
    end
  end

  context "#download" do
    it "without key" do
      expect_any_instance_of(Medias::Service).to receive(:show).with(
        "some-resource", ""
      ).and_return(media)

      expect(media).to receive(:open).and_return(
        StringIO.new("ab")
      )

      get "/medias/files/some-resource"

      expect(last_response.status).to eq 200
      expect(last_response.body).to eq("ab")
    end

    it "with key" do
      expect_any_instance_of(Medias::Service).to receive(:show).with(
        "some-resource", "some-key"
      ).and_return(media)

      expect(media).to receive(:open).and_return(
        StringIO.new("ab")
      )

      get "/medias/files/some-resource/some-key"

      expect(last_response.status).to eq 200
      expect(last_response.body).to eq("ab")
    end
  end

  it "index" do
    get "/medias"

    expect_any_instance_of(Medias::Service).to receive(:index).and_return([])

    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    expect(body[:data]).to eq([])
  end

  it "download" do
    expect_any_instance_of(Medias::Service).to receive(:download).with("some-resource", "some-key").and_return("file-content")

    get "/medias/d/some-resource/some-key"

    expect(last_response.status).to eq 200
    expect(last_response.body).to eq("file-content")
  end

  it "upload" do
    file = Rack::Test::UploadedFile.new("spec/fixtures/sample.mp4", "video/mp4")
    expect_any_instance_of(Medias::Service).to receive(:upload).with(
      instance_of(Hash),
      resource: "some-resource",
      key: "some-key"
    ).and_return(media)

    post "/medias/upload/some-resource/some-key", file: file

    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    record = deserialize body

    expect(record.id).to eq "1"
    expect(record.resource).to eq "some-resource"
    expect(record.key).to eq "some-key"
  end
end
