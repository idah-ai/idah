# frozen_string_literal: true

RSpec.describe Medias::Service, as: :system, database: true do
  subject { described_class.new(current_auth_context) }

  let(:file_path) { "./spec_data/sample.mp4" }

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

  describe "#authorize_action" do
    it "return true if the resources are authorized" do
      allow(Api[:idah].dataset.entries).to receive(:accessible_resources).and_return(true)
      pass
    end

    it "return false if any resources given is not authorized" do
      pass
    end
  end
end
