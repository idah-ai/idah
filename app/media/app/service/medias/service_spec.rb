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

      expect(result).to be_a(Hash)
      expect(result[:processed].length).to eq(1)
      expect(result[:processed].first.resource).to eq("test_resource")
      expect(result[:processed].first.key).to eq("test_key")
      expect(result[:processed].first.filename).to eq("test.mp4")
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

      expect(result).to be_a(Hash)
      expect(result[:processed].length).to eq(1)
      expect(result[:processed].first.resource).to eq("test_resource_no_key")
      expect(result[:processed].first.key).to eq("")
    ensure
      file&.close
    end

    it "extracts zip and returns multiple records" do
      require "zip"

      zip_path = Tempfile.create(["sample", ".zip"]).path
      Zip::OutputStream.open(zip_path) do |zip|
        zip.put_next_entry("photo1.jpg")
        zip.write("fake-jpg-content-1")
        zip.put_next_entry("photo2.jpg")
        zip.write("fake-jpg-content-2")
        zip.put_next_entry("subfolder/")
        # directory entry — should be skipped
      end

      zip_file = Verse::Http::UploadedFileStruct.new(
        {
          filename: "batch.zip",
          type: "application/zip",
          tempfile: File.open(zip_path, "rb")
        }
      )

      result = subject.upload(zip_file, resource: "ignored_for_zip", project_id: "mocked_project_id")

      expect(result).to be_a(Hash)
      expect(result[:processed].length).to eq(2)
      expect(result[:processed].map(&:filename)).to contain_exactly("photo1.jpg", "photo2.jpg")
      expect(result[:processed].map(&:key).uniq).to eq([""])
      expect(result[:processed].map(&:resource).uniq.length).to eq(2) # each image gets its own resource
    ensure
      FileUtils.rm_f(zip_path) if zip_path && File.exist?(zip_path)
    end

    it "skips system artifacts in zip files" do
      require "zip"

      zip_path = Tempfile.create(["system", ".zip"]).path
      Zip::OutputStream.open(zip_path) do |zip|
        zip.put_next_entry("photo1.jpg")
        zip.write("fake-jpg-content-1")
        zip.put_next_entry("__MACOSX/._photo1.jpg")
        zip.write("apple-double")
        zip.put_next_entry(".DS_Store")
        zip.write("ds-store")
      end

      zip_file = Verse::Http::UploadedFileStruct.new(
        {
          filename: "system.zip",
          type: "application/zip",
          tempfile: File.open(zip_path, "rb")
        }
      )

      result = subject.upload(zip_file, resource: "res", project_id: "pid")

      expect(result[:processed].length).to eq(1)
      expect(result[:processed].first.filename).to eq("photo1.jpg")
      expect(result[:skipped]).to be_empty
    ensure
      FileUtils.rm_f(zip_path) if zip_path && File.exist?(zip_path)
    end

    it "detects zip file by extension even if mime type is generic" do
      require "zip"

      zip_path = Tempfile.create(["ext", ".zip"]).path
      Zip::OutputStream.open(zip_path) do |zip|
        zip.put_next_entry("test.txt")
        zip.write("content")
      end

      # mime type is application/octet-stream but extension is .zip
      zip_file = Verse::Http::UploadedFileStruct.new(
        {
          filename: "archive.zip",
          type: "application/octet-stream",
          tempfile: File.open(zip_path, "rb")
        }
      )

      result = subject.upload(zip_file, resource: "res", project_id: "pid")
      expect(result[:processed].length).to eq(1)
      expect(result[:processed].first.filename).to eq("test.txt")
    ensure
      FileUtils.rm_f(zip_path) if zip_path && File.exist?(zip_path)
    end

    it "reports skipped files when modality doesn't allow mime type" do
      expect(Processor::Registry).to receive(:allowed_mime_types).with("test_modality").and_return(["image/.*"]).at_least(:once)

      # Upload a video file (video/mp4) with a modality that only allows images
      result = subject.upload(
        Verse::Http::UploadedFileStruct.new(
          {
            filename: "video.mp4",
            type: "video/mp4",
            tempfile: File.open(file_path, "rb")
          }
        ),
        resource: "test_res",
        project_id: "pid",
        modality: "test_modality"
      )

      expect(result[:processed]).to be_empty
      expect(result[:skipped]).to eq([{ filename: "video.mp4", message: "File type is not supported" }])
    end

    it "skips unsupported files within a zip and reports them" do
      expect(Processor::Registry).to receive(:allowed_mime_types).with("image_only").and_return(["image/.*"]).at_least(:once)

      require "zip"
      zip_path = Tempfile.create(["mixed", ".zip"]).path
      Zip::OutputStream.open(zip_path) do |zip|
        zip.put_next_entry("image.jpg")
        zip.write("fake-jpg")
        zip.put_next_entry("script.sh")
        zip.write("echo hi")
      end

      zip_file = Verse::Http::UploadedFileStruct.new(
        {
          filename: "mixed.zip",
          type: "application/zip",
          tempfile: File.open(zip_path, "rb")
        }
      )

      result = subject.upload(zip_file, resource: "res", project_id: "pid", modality: "image_only")

      expect(result[:processed].length).to eq(1)
      expect(result[:processed].first.filename).to eq("image.jpg")
      expect(result[:skipped]).to eq([{ filename: "script.sh", message: "File type is not supported" }])
    ensure
      FileUtils.rm_f(zip_path) if zip_path && File.exist?(zip_path)
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
