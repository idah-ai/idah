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

  context "#upload" do
    let(:file) do
      # Create a tempfile to to upload:
      Rack::Test::UploadedFile.new(
        Tempfile.create(["sample", ".mp4"]).tap do |f|
          f.write("ab")
          f.rewind
        end.path,
        "video/mp4",
        original_filename: "sample.mp4"
      )
    end
    it "without key" do
      expect_any_instance_of(Medias::Service).to receive(:upload) do |_service, file, resource:, key:, project_id:|
        expect(file.filename).to eq("sample.mp4")
        expect(file.type).to eq("video/mp4")
        expect(file.name).to eq("file")
        expect(resource).to eq("some-resource")
        expect(key).to eq("")
        expect(project_id).to eq("mocked_project_id")

        media
      end

      post "/medias/files/some-resource", { file: file, project_id: "mocked_project_id" }

      expect(last_response.status).to eq 200
    end

    it "with key" do
      expect_any_instance_of(Medias::Service).to receive(:upload) do |_service, file, resource:, key:, project_id:|
        expect(file.filename).to eq("sample.mp4")
        expect(file.type).to eq("video/mp4")
        expect(file.name).to eq("file")
        expect(resource).to eq("some-resource")
        expect(key).to eq("some-key")
        expect(project_id).to eq("mocked_project_id")

        media
      end.and_return(media)

      post "/medias/files/some-resource/some-key", { file: file, project_id: "mocked_project_id" }

      expect(last_response.status).to eq 200
    end
  end
end
