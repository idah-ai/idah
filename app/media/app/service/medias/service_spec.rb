# frozen_string_literal: true

RSpec.describe Medias::Service, as: :system, database: true do
  subject { described_class.new(current_auth_context) }

  let(:file_path) { "./spec_data/sample.mp4" }

  it "can upload file" do
    subject.upload(
      Rack::Test::UploadedFile.new(
        file_path
      ),
      resource: "test_resource",
      key: "test_key"
    )
  end
end
