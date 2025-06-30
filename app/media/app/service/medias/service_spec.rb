# frozen_string_literal: true

RSpec.describe Medias::Service, as: :system do
  subject { described_class.new(current_auth_context) }

  let(:file_path) { "./spec_data/sample.mp4" }

  it "can upload file" do
    Verse::Plugin[:shrine].with_storage do |storage|
      output = storage.upload(
        file.tempfile
      )

      metadata = auth_context.metadata

      id = output.id

      files.create(
        {
          id:,
          size: output.size,
          mime_type: output.mime_type || "application/octet-stream",
          created_by: metadata[:id],
          created_role: metadata[:role]&.to_s
        }
      )

      files.find!(id)
    end
  end
end
