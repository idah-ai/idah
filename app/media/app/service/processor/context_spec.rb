# frozen_string_literal: true

require "spec_helper"

RSpec.describe Processor::Context, type: :repository, database: true do
  let(:auth_context) do
    Verse::Auth::Context.new
  end

  let(:job) { double("job", update_progress: nil, reschedule!: nil, error: nil) }
  let(:resource) { "some-resource" }
  let(:config) { {} }

  let(:context) do
    described_class.new(auth_context, job, resource, config)
  end

  let(:media_repo) { Medias::Repository.new(auth_context) }

  let!(:tempfile) do
    Tempfile.new("test-file").tap do |f|
      f.write("test-content")
      f.rewind
    end
  end

  after do
    tempfile.close
    tempfile.unlink
  end

  describe "#download_original" do
    context "when media is found" do
      it "downloads the file and returns the path to a temporary file" do
        uploaded_file = nil
        Verse::Plugin[:shrine].with_storage do |storage|
          uploaded_file = storage.upload(tempfile)
        end

        media_id = media_repo.create(
          id: uploaded_file.id,
          resource: resource,
          key: "",
          filename: "file.txt",
          size: 123,
          mime_type: "text/plain",
        )

        temp_path = context.download_original

        expect(File.read(temp_path)).to eq("test-content")
        expect(temp_path).to include("idah_media_#{media_id}_")
      end
    end

    context "when media is not found" do
      it "raises an error" do
        expect { context.download_original }.to raise_error("media not found")
      end
    end
  end

  describe "#upload_media" do
    context "when media does not exist" do
      it "uploads the new media" do
        context.upload_media(tempfile, "new_key", "image/png")

        media = media_repo.find_by({resource: resource, key: "new_key"})
        expect(media).not_to be_nil
        expect(media.mime_type).to eq("image/png")

        Verse::Plugin[:shrine].with_storage do |storage|
          file = media.open
          expect(file).to be_a(File)
          file.close
        end
      end

      it "deletes the file from storage on transaction rollback" do
        file_id = nil

        expect do
          expect do
            count = media_repo.table.count
            media_repo.transaction do
              context.upload_media(tempfile, "new_key", "image/png")
              media = media_repo.find_by!({resource: resource, key: "new_key"})
              file_id = media.id
              raise Sequel::Rollback
            end
            expect(media_repo.table.count).to eq(count)
          end
        end

      end
    end

    context "when media already exists" do
      before do
        Medias::Repository.new(auth_context).create(
          id: "existing-id",
          resource: resource,
          key: "existing_key",
          filename: "existing.txt",
          size: 456,
          mime_type: "text/plain",
        )
      end

      it "skips the upload" do
        expect(Verse::Plugin[:shrine]).to receive(:with_storage).at_most(:once).and_call_original

        expect {
          context.upload_media(tempfile, "existing_key", "image/png")
        }.not_to(change { media_repo.table.count })
      end
    end
  end

  describe "job status methods" do
    it "delegates progress to the job" do
      expect(job).to receive(:update_progress).with(50)
      context.progress = 50
    end

    it "delegates reschedule to the job" do
      expect(job).to receive(:reschedule!).with(after: 20)
      context.reschedule!(after: 20)
    end

    it "delegates error to the job" do
      expect(job).to receive(:error).with("Something went wrong")
      context.error!("Something went wrong")
    end
  end
end
