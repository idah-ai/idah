# frozen_string_literal: true

require_relative "../../../spec_helper"

RSpec.describe Exports::Upd::Exporter do
  subject(:exporter) { described_class.new }

  describe "metadata methods" do
    describe "#name" do
      it "returns the exporter name" do
        expect(exporter.name).to eq("Universal Portable Dataset")
      end
    end

    describe "#description" do
      it "returns the exporter description" do
        expect(exporter.description).to eq("Export to UPD file.")
      end
    end

    describe "#options" do
      it "returns an empty schema" do
        expect(exporter.options).to eq(Verse::Schema.empty)
      end
    end
  end

  describe "#export" do
    let(:mock_job) { double("Job", progress: 0, update_progress: true) }
    let(:dataset_id) { "019ba0dd-4beb-757b-b5fb-de54446534e0" }
    let(:entry_id) { "019bc0fa-025e-7a8c-a3f4-82b276508315" }
    let(:annotation_id) { "019b2aec-94ff-7b50-bb44-8a3675e266f3" }
    let(:media_id) { "004f2b1c21bf42e0efe8b709a688afce.mov" }
    let(:options) { {} }
    let(:context) { Exports::Context.new(mock_job, [dataset_id], options) }

    let(:dataset_data) do
      JSON.parse(File.read("app/spec_data/api_data/datasets.json"))
    end

    let(:entry_data) do
      JSON.parse(File.read("app/spec_data/api_data/entries.json"))
    end

    let(:annotation_data) do
      JSON.parse(File.read("app/spec_data/api_data/annotations.json"))
    end

    let(:media_data) do
      JSON.parse(File.read("app/spec_data/api_data/medias.json"))
    end

    let(:dataset_response) do
      dataset_attrs = dataset_data["data"][0]["attributes"]
      double(
        "Dataset",
        id: dataset_id,
        name: dataset_attrs["name"],
        modality: dataset_attrs["modality"],
        data: {
          attributes: dataset_attrs.transform_keys(&:to_sym)
        }
      )
    end

    let(:entry_response) do
      entry_attrs = entry_data["data"][0]["attributes"]
      double(
        "Entry",
        id: entry_id,
        resource: entry_attrs["resource"],
        data: {
          attributes: entry_attrs.transform_keys(&:to_sym)
        }
      )
    end

    let(:annotation_response) do
      annotation_attrs = annotation_data["data"][0]["attributes"]
      double(
        "Annotation",
        id: annotation_id,
        dimensions: annotation_attrs["dimensions"].transform_keys(&:to_sym),
        annotation: annotation_attrs["annotation"].transform_keys(&:to_sym),
        data: {
          attributes: {
            created_by_email: annotation_attrs["created_by_email"],
            created_at: annotation_attrs["created_at"],
            updated_at: annotation_attrs["updated_at"],
            metadata: annotation_attrs["metadata"] || {}
          }
        }
      )
    end

    let(:media_response) do
      media_attrs = media_data["data"][0]["attributes"]
      double(
        "Media",
        id: media_data["data"][0]["id"],
        resource: media_attrs["resource"],
        key: media_attrs["key"],
        filename: media_attrs["filename"],
        mime_type: media_attrs["mime_type"]
      )
    end

    let(:media_binary_data) { "fake binary video data" }
    let(:mock_file) { instance_double(File, close: true) }

    before do
      # Stub ENV
      allow(ENV).to receive(:fetch).with("IDAH_URL").and_return("http://localhost:3000/")

      # Stub API calls
      allow(Api[:idah].dataset.datasets).to receive(:show).with(id: dataset_id).and_return(dataset_response)
      allow(Api[:idah].dataset.entries).to receive(:index_all).and_return([entry_response])
      allow(Api[:idah].dataset.annotations).to receive(:index_all).and_return([annotation_response])
      allow(Api[:idah].media.medias).to receive(:index_all).and_return([media_response])
      allow(Api[:idah].media.medias).to receive(:files).and_return(media_binary_data)

      # Stub system calls by default
      allow(exporter).to receive(:system).and_return(true)

      # Stub File operations - prevent actual file opening
      allow(File).to receive(:open).and_call_original
      allow(File).to receive(:open).with(%r{/tmp/idah-export-\d+\.upd}).and_return(mock_file)
      allow(File).to receive(:extname).and_call_original
      allow(File).to receive(:basename).and_call_original

      # Stub Tempfile
      allow(Tempfile).to receive(:new).and_return(
        instance_double(Tempfile, binmode: true, write: true, rewind: true, path: "/tmp/tempfile")
      )
    end

    context "basic export flow" do
      it "initializes a UPD file with updcli-static" do
        init_called = false
        allow(exporter).to receive(:system) do |cmd, options|
          if cmd.include?("init")
            init_called = true
            expect(cmd).to match(%r{bin/updcli-static --input /tmp/idah-export-\d+\.upd init})
            expect(options).to eq({ exception: true })
          end
          true
        end

        exporter.export(context)
        expect(init_called).to be(true)
      end

      it "creates datasets in the UPD file" do
        dataset_created = false
        allow(exporter).to receive(:system) do |cmd, _options|
          if cmd.include?("dataset create")
            dataset_created = true
            expect(cmd).to include("--id \"#{dataset_id}\"")
            expect(cmd).to include("--name \"Dataset 1\"")
            expect(cmd).to include("--modality idah-video")
            expect(cmd).to include("--metadata")
          end
          true
        end

        exporter.export(context)
        expect(dataset_created).to be(true)
      end

      it "creates entries in the UPD file" do
        entry_created = false
        allow(exporter).to receive(:system) do |cmd, _options|
          if cmd.include?("entry create")
            entry_created = true
            expect(cmd).to include("--id \"#{entry_id}\"")
            expect(cmd).to include("--dataset_id \"#{dataset_id}\"")
            expect(cmd).to include("--url \"http://localhost:3000/api/v1/media/medias/files/4c2052a1475842e9.mov\"")
            expect(cmd).to include("--metadata")
          end
          true
        end

        exporter.export(context)
        expect(entry_created).to be(true)
      end

      it "creates annotations in the UPD file" do
        annotation_created = false
        allow(exporter).to receive(:system) do |cmd, _options|
          if cmd.include?("annotation create")
            annotation_created = true
            expect(cmd).to include("--id \"#{annotation_id}\"")
            expect(cmd).to include("--entry_id \"#{entry_id}\"")
            expect(cmd).to include("--type \"idah-video:bounding-box\"")
            expect(cmd).to include("--shape")
            expect(cmd).to include("--annotation")
            expect(cmd).to include("--metadata")
          end
          true
        end

        exporter.export(context)
        expect(annotation_created).to be(true)
      end

      it "sets the file to context.io" do
        exporter.export(context)

        expect(context.io.file).to eq(mock_file)
      end

      it "creates a temporary UPD file with timestamp" do
        allow(Time).to receive_message_chain(:now, :to_i).and_return(1_234_567_890)

        init_with_timestamp = false
        allow(exporter).to receive(:system) do |cmd, _options|
          if cmd.include?("init")
            init_with_timestamp = cmd.include?("/tmp/idah-export-1234567890.upd")
          end
          true
        end

        exporter.export(context)
        expect(init_with_timestamp).to be(true)
      end
    end

    context "metadata transformation" do
      it "transforms dataset metadata keys to capitalized-dashed format" do
        dataset_metadata_valid = false
        allow(exporter).to receive(:system) do |cmd, _options|
          if cmd.include?("dataset create")
            json_match = cmd.match(/--metadata '({.*})'/)
            if json_match
              metadata = JSON.parse(json_match[1])
              dataset_metadata_valid = metadata.key?("Labeling-Configuration") &&
                                       metadata.key?("Workflow-Configuration") &&
                                       metadata.key?("Status") &&
                                       metadata.key?("Progress") &&
                                       metadata.key?("Entries-Total-Count") &&
                                       metadata.key?("Created-At") &&
                                       metadata.key?("Updated-At")
            end
          end
          true
        end

        exporter.export(context)
        expect(dataset_metadata_valid).to be(true)
      end

      it "transforms entry metadata keys to capitalized-dashed format" do
        entry_metadata_valid = false
        allow(exporter).to receive(:system) do |cmd, _options|
          if cmd.include?("entry create")
            json_match = cmd.match(/--metadata '({.*})'/)
            if json_match
              metadata = JSON.parse(json_match[1])
              entry_metadata_valid = metadata.key?("Priority") &&
                                     metadata.key?("Wf-Step") &&
                                     metadata.key?("Status") &&
                                     metadata.key?("Resource") &&
                                     metadata.key?("Assigned-To-Id") &&
                                     metadata.key?("Created-At") &&
                                     metadata.key?("Updated-At")
            end
          end
          true
        end

        exporter.export(context)
        expect(entry_metadata_valid).to be(true)
      end

      it "transforms annotation metadata with special created-by field" do
        annotation_metadata_valid = false
        allow(exporter).to receive(:system) do |cmd, _options|
          if cmd.include?("annotation create")
            json_match = cmd.match(/--metadata '({.*})'/)
            if json_match
              metadata = JSON.parse(json_match[1])
              annotation_metadata_valid = metadata.key?("Created-By") &&
                                          metadata["Created-By"] == "admin@idah.ai" &&
                                          metadata.key?("Created-At") &&
                                          metadata.key?("Updated-At")
            end
          end
          true
        end

        exporter.export(context)
        expect(annotation_metadata_valid).to be(true)
      end
    end

    context "annotation dimensions handling" do
      it "extracts type from dimensions and passes shape separately" do
        shape_valid = false
        allow(exporter).to receive(:system) do |cmd, _options|
          if cmd.include?("annotation create") && cmd.include?("--type \"idah-video:bounding-box\"")
            # Shape should not contain type
            shape_match = cmd.match(/--shape '({.*?})' --annotation/)
            if shape_match
              shape = JSON.parse(shape_match[1])
              shape_valid = !shape.key?("type") && shape.key?("end") && shape.key?("start")
            end
          end
          true
        end

        exporter.export(context)
        expect(shape_valid).to be(true)
      end

      it "passes annotation data as JSON" do
        annotation_valid = false
        allow(exporter).to receive(:system) do |cmd, _options|
          if cmd.include?("annotation create")
            annotation_match = cmd.match(/--annotation '({.*?})' --metadata/)
            if annotation_match
              annotation = JSON.parse(annotation_match[1])
              annotation_valid = (annotation == { "category" => "vehicles/car" })
            end
          end
          true
        end

        exporter.export(context)
        expect(annotation_valid).to be(true)
      end
    end

    context "media handling" do
      context "when include_medias option is not set" do
        let(:options) { {} }

        it "does not include any medias" do
          media_created = false
          allow(exporter).to receive(:system) do |cmd, _options|
            media_created = true if cmd.include?("media create")
            true
          end

          exporter.export(context)
          expect(media_created).to be(false)
        end
      end

      context "when include_medias is 'original'" do
        let(:options) { { include_medias: "original" } }

        it "includes only media with empty key" do
          allow(Api[:idah].media.medias).to receive(:index_all).and_return(
            [
              double(
                "Media",
                id: "media1",
                resource: "res1",
                key: "",
                filename: "file.mov",
                mime_type: "video/quicktime"
              ),
              double(
                "Media",
                id: "media2",
                resource: "res1",
                key: "240p.m3u8",
                filename: "240p.m3u8",
                mime_type: "application/vnd.apple.mpegurl"
              )
            ]
          )
          allow(Api[:idah].media.medias).to receive(:files).and_return("binary")

          media_create_count = 0
          allow(exporter).to receive(:system) do |cmd, _options|
            media_create_count += 1 if cmd.include?("media create")
            true
          end

          exporter.export(context)
          expect(media_create_count).to eq(1) # Only original media
        end
      end

      context "when include_medias is 'all'" do
        let(:options) { { include_medias: "all" } }

        it "includes all medias" do
          allow(Api[:idah].media.medias).to receive(:index_all).and_return(
            [
              double(
                "Media",
                id: "media1",
                resource: "res1",
                key: "",
                filename: "file.mov",
                mime_type: "video/quicktime"
              ),
              double(
                "Media",
                id: "media2",
                resource: "res1",
                key: "240p.m3u8",
                filename: "240p.m3u8",
                mime_type: "application/vnd.apple.mpegurl"
              )
            ]
          )
          allow(Api[:idah].media.medias).to receive(:files).and_return("binary")

          media_create_count = 0
          allow(exporter).to receive(:system) do |cmd, _options|
            media_create_count += 1 if cmd.include?("media create")
            true
          end

          exporter.export(context)
          expect(media_create_count).to eq(2) # All medias
        end
      end

      context "media creation" do
        let(:options) { { include_medias: "all" } }

        it "downloads media binary data" do
          expect(Api[:idah].media.medias).to receive(:files).with(
            resource: "4c2052a1475842e9.mov",
            key: ""
          ).and_return(media_binary_data)

          exporter.export(context)
        end

        it "creates tempfile with correct extension" do
          expect(File).to receive(:extname).with("dc160a222abc4a6e.mov").and_return(".mov")
          expect(File).to receive(:basename).with("dc160a222abc4a6e.mov", ".mov").and_return("dc160a222abc4a6e")
          expect(Tempfile).to receive(:new).with(["dc160a222abc4a6e", ".mov"]).and_return(
            instance_double(Tempfile, binmode: true, write: true, rewind: true, path: "/tmp/tempfile.mov")
          )

          exporter.export(context)
        end

        it "writes binary data to tempfile" do
          tempfile = instance_double(Tempfile, binmode: true, rewind: true, path: "/tmp/tempfile.mov")
          allow(Tempfile).to receive(:new).and_return(tempfile)

          expect(tempfile).to receive(:write).with(media_binary_data)

          exporter.export(context)
        end

        it "creates media in UPD file with correct parameters" do
          media_params_valid = false
          allow(exporter).to receive(:system) do |cmd, _options|
            if cmd.include?("media create")
              media_params_valid = cmd.include?("--id \"#{media_id}\"") &&
                                   cmd.include?("--file \"/tmp/tempfile\"") &&
                                   cmd.include?("--key \"\"") &&
                                   cmd.include?("--mimetype \"video/quicktime\"")
            end
            true
          end

          exporter.export(context)
          expect(media_params_valid).to be(true)
        end
      end
    end

    context "multiple datasets" do
      let(:other_dataset_id) { "019ba0dd-4beb-757b-b5fb-de54446534e1" }
      let(:context) { Exports::Context.new(mock_job, [dataset_id, other_dataset_id], options) }

      let(:other_dataset_response) do
        double(
          "Dataset",
          id: other_dataset_id,
          name: "Test Dataset 6",
          modality: "image",
          data: {
            attributes: {
              labeling_configuration: {},
              workflow_configuration: {},
              labels: [],
              status: "active",
              progress: 0.5,
              entries_total_count: 5,
              entries_completed_count: 2,
              entries_in_progress_count: 1,
              created_at: "2026-01-10 03:46:56 +0000",
              updated_at: "2026-01-10 04:07:10 +0000"
            }
          }
        )
      end

      before do
        allow(Api[:idah].dataset.datasets).to receive(:show).with(id: dataset_id).and_return(dataset_response)
        allow(Api[:idah].dataset.datasets).to receive(:show).with(id: other_dataset_id).and_return(other_dataset_response)
        allow(Api[:idah].dataset.entries).to receive(:index_all).and_return([])
      end

      it "creates multiple datasets in UPD file" do
        dataset_creates = 0
        allow(exporter).to receive(:system) do |cmd, _options|
          if cmd.include?("dataset create")
            dataset_creates += 1
          end
          true
        end

        exporter.export(context)
        expect(dataset_creates).to eq(2)
      end
    end

    context "when system command fails" do
      it "raises an exception" do
        allow(exporter).to receive(:system).with(
          anything,
          exception: true
        ).and_raise(RuntimeError.new("Command failed"))

        expect {
          exporter.export(context)
        }.to raise_error(RuntimeError, "Command failed")
      end
    end

    context "empty datasets" do
      let(:context) { Exports::Context.new(mock_job, [dataset_id], options) }

      before do
        allow(Api[:idah].dataset.entries).to receive(:index_all).and_return([])
      end

      it "creates dataset without entries" do
        dataset_created = false
        entry_created = false
        allow(exporter).to receive(:system) do |cmd, _options|
          dataset_created = true if cmd.include?("dataset create")
          entry_created = true if cmd.include?("entry create")
          true
        end

        exporter.export(context)
        expect(dataset_created).to be(true)
        expect(entry_created).to be(false)
      end
    end

    context "entries without annotations" do
      before do
        allow(Api[:idah].dataset.annotations).to receive(:index_all).and_return([])
      end

      it "creates entries without annotations" do
        annotation_created = false
        allow(exporter).to receive(:system) do |cmd, _options|
          annotation_created = true if cmd.include?("annotation create")
          true
        end

        exporter.export(context)
        expect(annotation_created).to be(false)
      end
    end

    context "context progress tracking" do
      let(:other_dataset_id) { "019ba0dd-4beb-757b-b5fb-de54446534e1" }
      let(:context) { Exports::Context.new(mock_job, [dataset_id, other_dataset_id], options) }

      before do
        allow(Api[:idah].dataset.datasets).to receive(:show).with(id: dataset_id).and_return(dataset_response)
        allow(Api[:idah].dataset.datasets).to receive(:show).with(id: other_dataset_id).and_return(dataset_response)
        allow(Api[:idah].dataset.entries).to receive(:index_all).and_return([])
      end

      it "updates progress as datasets are processed" do
        expect(mock_job).to receive(:update_progress).with(0.5).ordered
        expect(mock_job).to receive(:update_progress).with(1.0).ordered

        exporter.export(context)
      end
    end
  end

  describe "#capitalized_dashed_keys (private method)" do
    it "transforms underscore keys to capitalized-dashed format" do
      input = {
        created_at: "2026-01-01",
        updated_at: "2026-01-02",
        entries_total_count: 10
      }

      result = exporter.send(:capitalized_dashed_keys, input)

      expect(result).to eq(
        {
          "Created-At" => "2026-01-01",
          "Updated-At" => "2026-01-02",
          "Entries-Total-Count" => 10
        }
      )
    end

    it "handles single word keys" do
      input = { status: "active", progress: 0.5 }

      result = exporter.send(:capitalized_dashed_keys, input)

      expect(result).to eq(
        {
          "Status" => "active",
          "Progress" => 0.5
        }
      )
    end

    it "handles empty hash" do
      result = exporter.send(:capitalized_dashed_keys, {})
      expect(result).to eq({})
    end
  end
end
