# frozen_string_literal: true

RSpec.describe Medias::Service, as: :system, database: true do
  subject { described_class.new(current_auth_context) }

  let(:file_path) {
    Tempfile.create(["sample", ".mp4"]).tap do |f|
      f.write("ab")
      f.rewind
    end.path
  }
  after{ FileUtils.rm_f(file_path) if File.exist?(file_path) }

  it "can upload file" do
    file = File.open(file_path, "rb")
    subject.upload(
      Verse::Http::UploadedFileStruct.new(
        {
          filename: "test.mp4",
          type: "application/octet-stream",
          tempfile: File.open(file_path, "rb")
        }
      ),
      resource: "test_resource",
      key: "test_key"
    )
  ensure
    file&.close
  end
end
