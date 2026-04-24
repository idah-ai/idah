# frozen_string_literal: true

RSpec.describe Medias::Service, as: :system, database: true do
  subject { described_class.new(current_auth_context) }

  let(:file_path) {
    Tempfile.create(["sample", ".mp4"]).tap do |f|
      f.write("ab")
      f.rewind
    end.path
  }
  after { FileUtils.rm_f(file_path) if File.exist?(file_path) }

  let(:uploaded_file) {
    Verse::Http::UploadedFileStruct.new(
      {
        filename: "test.mp4",
        type: "application/octet-stream",
        tempfile: File.open(file_path, "rb")
      }
    )
  }

  describe "#upload" do
    it "can upload file" do
      file = File.open(file_path, "rb")
      result = subject.upload(
        Verse::Http::UploadedFileStruct.new(
          {
            filename: "test.mp4",
            type: "application/octet-stream",
            tempfile: File.open(file_path, "rb")
          }
        ),
        resource: "test_resource",
        key: "test_key",
        project_id: "mocked_project_id"
      )

      expect(result).to be_truthy
      expect(result.resource).to eq("test_resource")
      expect(result.key).to eq("test_key")
      expect(result.filename).to eq("test.mp4")
    ensure
      file&.close
    end

    it "raises validation error when resource/key already exists" do
      file = File.open(file_path, "rb")

      # Upload first file
      subject.upload(
        Verse::Http::UploadedFileStruct.new(
          {
            filename: "test.mp4",
            type: "application/octet-stream",
            tempfile: File.open(file_path, "rb")
          }
        ),
        resource: "test_resource",
        key: "test_key",
        project_id: "mocked_project_id"
      )

      # Try to upload duplicate
      expect do
        subject.upload(
          Verse::Http::UploadedFileStruct.new(
            {
              filename: "test2.mp4",
              type: "application/octet-stream",
              tempfile: File.open(file_path, "rb")
            }
          ),
          resource: "test_resource",
          key: "test_key",
          project_id: "mocked_project_id"
        )
      end.to raise_error(Verse::Error::ValidationFailed, /Resource test_resource with key test_key already exists/)
    ensure
      file&.close
    end

    it "uploads file with empty key" do
      file = File.open(file_path, "rb")
      result = subject.upload(
        Verse::Http::UploadedFileStruct.new(
          {
            filename: "test.mp4",
            type: "application/octet-stream",
            tempfile: File.open(file_path, "rb")
          }
        ),
        resource: "test_resource_no_key",
        key: "",
        project_id: "mocked_project_id"
      )

      expect(result).to be_truthy
      expect(result.resource).to eq("test_resource_no_key")
      expect(result.key).to eq("")
    ensure
      file&.close
    end
  end

  describe "#create" do
    let(:media_record) do
      Verse::JsonApi::Struct.new(
        attributes: {
          id: "test_id",
          resource: "test_resource_create",
          filename: "test.mp4",
          key: "key1",
          size: 1024,
          mime_type: "video/mp4",
          created_by: 1,
          created_role: "admin"
        }
      )
    end

    it "creates a media record" do
      result = subject.create(media_record)

      expect(result).to be_truthy
      expect(result.id).to eq("test_id")
      expect(result.resource).to eq("test_resource_create")
      expect(result.filename).to eq("test.mp4")
    end
  end

  describe "#index" do
    before do
      file = File.open(file_path, "rb")
      subject.upload(
        Verse::Http::UploadedFileStruct.new(
          {
            filename: "test1.mp4",
            type: "video/mp4",
            tempfile: File.open(file_path, "rb")
          }
        ),
        resource: "resource1",
        key: "key1",
        project_id: "mocked_project_id"
      )

      subject.upload(
        Verse::Http::UploadedFileStruct.new(
          {
            filename: "test2.mp4",
            type: "video/mp4",
            tempfile: File.open(file_path, "rb")
          }
        ),
        resource: "resource2",
        key: "key2",
        project_id: "mocked_project_id"
      )
      file&.close
    end

    it "returns list of media files" do
      result = subject.index

      expect(result.length).to be >= 2
      expect(result.map(&:resource)).to include("resource1", "resource2")
    end
  end

  describe "#show" do
    let!(:uploaded_media) do
      file = File.open(file_path, "rb")
      result = subject.upload(
        Verse::Http::UploadedFileStruct.new(
          {
            filename: "show_test.mp4",
            type: "video/mp4",
            tempfile: File.open(file_path, "rb")
          }
        ),
        resource: "show_resource",
        key: "show_key",
        project_id: "mocked_project_id"
      )
      file&.close
      result
    end

    it "retrieves media by resource and key" do
      result = subject.show("show_resource", "show_key")

      expect(result).to be_truthy
      expect(result.resource).to eq("show_resource")
      expect(result.key).to eq("show_key")
      expect(result.filename).to eq("show_test.mp4")
    end

    it "raises error when media not found" do
      expect do
        subject.show("nonexistent_resource", "nonexistent_key")
      end.to raise_error(Verse::Error::NotFound)
    end
  end

  describe "#delete" do
    let!(:uploaded_media) do
      file = File.open(file_path, "rb")
      result = subject.upload(
        Verse::Http::UploadedFileStruct.new(
          {
            filename: "delete_test.mp4",
            type: "video/mp4",
            tempfile: File.open(file_path, "rb")
          }
        ),
        resource: "delete_resource",
        key: "delete_key",
        project_id: "mocked_project_id"
      )
      file&.close
      result
    end

    it "deletes media by resource and key" do
      expect do
        subject.delete("delete_resource", "delete_key")
      end.not_to raise_error

      # Verify it's deleted
      expect do
        subject.show("delete_resource", "delete_key")
      end.to raise_error(Verse::Error::NotFound)
    end

    it "raises error when trying to delete non-existent media" do
      expect do
        subject.delete("nonexistent_resource", "nonexistent_key")
      end.to raise_error(Verse::Error::NotFound)
    end
  end
end
