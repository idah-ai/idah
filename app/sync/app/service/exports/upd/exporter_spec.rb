# frozen_string_literal: true

require_relative "../../../spec_helper"

RSpec.describe Exports::Upd::Exporter do
  let(:mock_executor) { instance_double(Executor) }
  let(:executor_result) { instance_double(Process::Status, success?: true) }

  before do
    allow(Executor).to receive(:new).and_return(mock_executor)
    allow(mock_executor).to receive(:call).and_return(executor_result)
  end

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
    let(:dataset_id) { "019bba87-7810-7935-a8ae-d2a6bacebecb" }
    let(:entry_id) { "019bba87-9818-7967-8233-35fa9807d8fa" }
    let(:annotation_id) { "019b2aec-94ff-7b50-bb44-8a3675e266f3" }
    let(:media_id) { "004f2b1c21bf42e0efe8b709a688afce.mov" }
    let(:options) { {} }
    let(:context) { Exports::Context.new(mock_job, [dataset_id], options) }

    let(:dataset_data) do
      JSON.parse(File.read("app/spec_data/api_data/datasets.json"), symbolize_names: true)
    end

    let(:entry_data) do
      JSON.parse(File.read("app/spec_data/api_data/entries.json"), symbolize_names: true)
    end

    let(:annotation_data) do
      JSON.parse(File.read("app/spec_data/api_data/annotations.json"), symbolize_names: true)
    end

    let(:media_data) do
      JSON.parse(File.read("app/spec_data/api_data/medias.json"), symbolize_names: true)
    end

    let(:dataset_response) do
      Verse::JsonApi::Struct.new dataset_data[:data][0]
    end

    let(:entry_response) do
      Verse::JsonApi::Struct.new entry_data[:data][0]
    end

    let(:annotation_response) do
      Verse::JsonApi::Struct.new annotation_data[:data][0]
    end

    let(:media_response) do
      Verse::JsonApi::Struct.new media_data[:data][0]
    end

    let(:media_binary_data) { "fake binary video data" }
    let(:streamed_chunks) { ["fake ", "binary ", "video ", "data"] }
    let(:mock_file) { instance_double(File, close: true) }

    # Track all updcli-static invocations for verification
    let(:updcli_calls) { [] }

    before do
      # Stub ENV
      allow(ENV).to receive(:fetch).with("IDAH_URL").and_return("http://localhost:3000/")

      # Stub API calls
      # index_all returns a paginated enumerator that yields pages (arrays of items).
      # Each stub returns an array of pages: [[item]].
      allow(Api[:idah].dataset.datasets).to receive(:show).with(id: dataset_id).and_return(dataset_response)
      allow(Api[:idah].dataset.entries).to receive(:index_all).and_return([[entry_response]])
      allow(Api[:idah].dataset.annotations).to receive(:index_all).and_return([[annotation_response]])
      allow(Api[:idah].media.medias).to receive(:index_all).and_return([[media_response]])
      allow(Api[:idah].media.medias).to receive(:files).and_return(media_binary_data)

      # Stub streaming media download to yield chunks
      allow(Api[:idah].media.medias).to receive(:files_stream) do |**_args, &block|
        streamed_chunks.each { |chunk| block.call(chunk) }
      end

      # Stub Dir.mktmpdir to return a predictable temp dir
      allow(Dir).to receive(:mktmpdir).with("idah-export-").and_return("/tmp/dummy-export-dir")

      # Stub File operations - prevent actual file opening
      allow(File).to receive(:open).and_call_original
      allow(File).to receive(:open).with("/tmp/dummy-export-dir/export.upd").and_return(mock_file)
      allow(File).to receive(:extname).and_call_original
      allow(File).to receive(:basename).and_call_original
      # Stub Tempfile — the streaming path uses `<<` (not `write`)
      # `<<` on Tempfile returns self, so mock it to return self for chaining
      mock_tempfile = instance_double(Tempfile, binmode: true, rewind: true, path: "/tmp/tempfile")
      allow(mock_tempfile).to receive(:<<).and_return(mock_tempfile)
      allow(Tempfile).to receive(:new).and_return(mock_tempfile)

      # Track executor calls for verification
      allow(mock_executor).to receive(:call) do |command, **opts|
        updcli_calls << { command: command, opts: opts }
        executor_result
      end
    end

    # Helper: parse the shell-escaped command string back into an array for inspection
    def parsed_args(call)
      _cmd, *args = Shellwords.split(call[:command])
      args
    end

    context "basic export flow" do
      it "initializes a UPD file with updcli-static" do
        exporter.export(context)

        init_call = updcli_calls.find { |c| parsed_args(c).include?("init") }
        expect(init_call).not_to be_nil
        expect(parsed_args(init_call)).to include("/tmp/dummy-export-dir/export.upd")
        expect(init_call[:opts][:timeout]).to eq(300)
      end

      it "creates datasets in the UPD file" do
        exporter.export(context)

        dataset_call = updcli_calls.find { |c| parsed_args(c).include?("dataset") && parsed_args(c).include?("create") }
        expect(dataset_call).not_to be_nil
        args = parsed_args(dataset_call)
        expect(args).to include("--id")
        expect(args).to include(dataset_id)
        expect(args).to include("--name")
        expect(args).to include("Dataset 1")
        expect(args).to include("--modality")
        expect(args).to include("idah-video")
        expect(args).to include("--metadata")
      end

      it "creates entries in the UPD file" do
        exporter.export(context)

        entry_call = updcli_calls.find { |c| parsed_args(c).include?("entry") && parsed_args(c).include?("create") }
        expect(entry_call).not_to be_nil
        args = parsed_args(entry_call)
        expect(args).to include("--id")
        expect(args).to include(entry_id)
        expect(args).to include("--dataset_id")
        expect(args).to include(dataset_id)
        expect(args).to include("--url")
        expect(args).to include("http://localhost:3000/api/v1/media/medias/files/4c2052a1475842e9.mov")
        expect(args).to include("--metadata")
      end

      it "creates annotations in the UPD file" do
        exporter.export(context)

        ann_call = updcli_calls.find { |c| parsed_args(c).include?("annotation") && parsed_args(c).include?("create") }
        expect(ann_call).not_to be_nil
        args = parsed_args(ann_call)
        expect(args).to include("--id")
        expect(args).to include(annotation_id)
        expect(args).to include("--entry_id")
        expect(args).to include(entry_id)
        expect(args).to include("--type")
        expect(args).to include("idah-video:bounding-box")
        expect(args).to include("--shape")
        expect(args).to include("--annotation")
        expect(args).to include("--metadata")
      end

      it "sets the file to context.io" do
        exporter.export(context)

        expect(context.io.file).to eq(mock_file)
      end

      it "creates a private temp directory via Dir.mktmpdir" do
        exporter.export(context)
        expect(Dir).to have_received(:mktmpdir).with("idah-export-")
      end

      it "passes timeout to all executor calls" do
        exporter.export(context)

        expect(updcli_calls).not_to be_empty
        updcli_calls.each do |call|
          expect(call[:opts][:timeout]).to eq(300)
        end
      end
    end

    context "metadata transformation" do
      it "transforms dataset metadata keys to capitalized-dashed format" do
        exporter.export(context)

        dataset_call = updcli_calls.find { |c| parsed_args(c).include?("dataset") && parsed_args(c).include?("create") }
        expect(dataset_call).not_to be_nil
        args = parsed_args(dataset_call)
        md_idx = args.index("--metadata")
        expect(md_idx).not_to be_nil
        metadata = JSON.parse(args[md_idx + 1])
        expect(metadata).to include(
          "Labeling-Configuration",
          "Workflow-Configuration",
          "Status",
          "Progress",
          "Entries-Total-Count",
          "Created-At",
          "Updated-At"
        )
      end

      it "transforms entry metadata keys to capitalized-dashed format" do
        exporter.export(context)

        entry_call = updcli_calls.find { |c| parsed_args(c).include?("entry") && parsed_args(c).include?("create") }
        expect(entry_call).not_to be_nil
        args = parsed_args(entry_call)
        md_idx = args.index("--metadata")
        expect(md_idx).not_to be_nil
        metadata = JSON.parse(args[md_idx + 1])
        expect(metadata).to include(
          "Priority",
          "Name",
          "Wf-Step",
          "Status",
          "Resource",
          "Assigned-To-Id",
          "Created-At",
          "Updated-At"
        )
      end

      it "transforms annotation metadata with special created-by field" do
        exporter.export(context)

        ann_call = updcli_calls.find { |c| parsed_args(c).include?("annotation") && parsed_args(c).include?("create") }
        expect(ann_call).not_to be_nil
        args = parsed_args(ann_call)
        md_idx = args.index("--metadata")
        expect(md_idx).not_to be_nil
        metadata = JSON.parse(args[md_idx + 1])
        expect(metadata["Created-By"]).to eq("admin@idah.ai")
        expect(metadata).to have_key("Created-At")
        expect(metadata).to have_key("Updated-At")
      end
    end

    context "annotation dimensions handling" do
      it "extracts type from dimensions and passes shape separately" do
        exporter.export(context)

        ann_call = updcli_calls.find { |c| parsed_args(c).include?("annotation") && parsed_args(c).include?("create") }
        expect(ann_call).not_to be_nil
        args = parsed_args(ann_call)
        type_idx = args.index("--type")
        shape_idx = args.index("--shape")
        expect(type_idx).not_to be_nil
        expect(shape_idx).not_to be_nil
        expect(args[type_idx + 1]).to eq("idah-video:bounding-box")
        shape = JSON.parse(args[shape_idx + 1])
        expect(shape).not_to have_key("type")
        expect(shape).to have_key("end")
        expect(shape).to have_key("start")
      end

      it "passes annotation data as JSON" do
        exporter.export(context)

        ann_call = updcli_calls.find { |c| parsed_args(c).include?("annotation") && parsed_args(c).include?("create") }
        expect(ann_call).not_to be_nil
        args = parsed_args(ann_call)
        ann_idx = args.index("--annotation")
        expect(ann_idx).not_to be_nil
        annotation = JSON.parse(args[ann_idx + 1])
        expect(annotation).to eq({ "category" => "vehicles/car" })
      end
    end

    context "media handling" do
      context "when include_medias option is not set" do
        let(:options) { {} }

        it "does not include any medias" do
          exporter.export(context)

          media_calls = updcli_calls.select { |c|
            parsed_args(c).include?("media") && parsed_args(c).include?("create")
          }
          expect(media_calls).to be_empty
        end
      end

      context "when include_medias is 'original'" do
        let(:options) { { include_medias: "original" } }

        it "includes only media with empty key" do
          allow(Api[:idah].media.medias).to receive(:index_all).with(
            filter: { resource: "res1", key: "" }
          ).and_return(
            [
              [
                double(
                  "Media",
                  id: "media1",
                  resource: "res1",
                  key: "",
                  filename: "file.mov",
                  mime_type: "video/quicktime"
                )
              ]
            ]
          )
          allow(Api[:idah].media.medias).to receive(:files).and_return("binary")

          exporter.export(context)

          media_calls = updcli_calls.select { |c|
            parsed_args(c).include?("media") && parsed_args(c).include?("create")
          }
          expect(media_calls.size).to eq(1) # Only original media
        end
      end

      context "when include_medias is 'all'" do
        let(:options) { { include_medias: "all" } }

        it "includes all medias" do
          allow(Api[:idah].media.medias).to receive(:index_all).and_return(
            [
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
            ]
          )
          allow(Api[:idah].media.medias).to receive(:files).and_return("binary")

          exporter.export(context)

          media_calls = updcli_calls.select { |c|
            parsed_args(c).include?("media") && parsed_args(c).include?("create")
          }
          expect(media_calls.size).to eq(2) # All medias
        end
      end

      context "media creation" do
        let(:options) { { include_medias: "all" } }

        it "streams media binary data via files_stream" do
          expect(Api[:idah].media.medias).to receive(:files_stream).with(
            resource: "4c2052a1475842e9.mov",
            key: ""
          ).and_yield("chunk1").and_yield("chunk2")

          exporter.export(context)
        end

        it "creates tempfile with correct extension" do
          expect(File).to receive(:extname).with("dc160a222abc4a6e.mov").and_return(".mov")
          expect(File).to receive(:basename).with("dc160a222abc4a6e.mov", ".mov").and_return("dc160a222abc4a6e")
          expect(Tempfile).to receive(:new).with(["dc160a222abc4a6e", ".mov"]).and_call_original

          exporter.export(context)
        end

        it "writes streamed chunks to tempfile via <<" do
          tempfile = instance_double(Tempfile, binmode: true, rewind: true, path: "/tmp/tempfile.mov")
          allow(Tempfile).to receive(:new).and_return(tempfile)

          streamed_chunks.each do |chunk|
            expect(tempfile).to receive(:<<).with(chunk).ordered
          end

          exporter.export(context)
        end

        it "creates media in UPD file with correct parameters" do
          # Override tempfile stub to return a path matching the media filename
          mock_tf = instance_double(Tempfile, binmode: true, rewind: true, path: "/tmp/tempfile.mov")
          allow(mock_tf).to receive(:<<).and_return(mock_tf)
          allow(Tempfile).to receive(:new).with(["dc160a222abc4a6e", ".mov"]).and_return(mock_tf)

          exporter.export(context)

          media_call = updcli_calls.find { |c| parsed_args(c).include?("media") && parsed_args(c).include?("create") }
          expect(media_call).not_to be_nil
          args = parsed_args(media_call)
          id_idx = args.index("--id")
          file_idx = args.index("--file")
          key_idx = args.index("--key")
          mime_idx = args.index("--mimetype")
          expect(id_idx).not_to be_nil
          expect(args[id_idx + 1]).to eq("4c2052a1475842e9.mov")
          expect(file_idx).not_to be_nil
          expect(args[file_idx + 1]).to eq("/tmp/tempfile.mov")
          expect(key_idx).not_to be_nil
          expect(args[key_idx + 1]).to eq("")
          expect(mime_idx).not_to be_nil
          expect(args[mime_idx + 1]).to eq("video/quicktime")
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
        allow(Api[:idah].dataset.datasets).to(
          receive(:show).with(id: dataset_id).and_return(dataset_response)
        )
        allow(Api[:idah].dataset.datasets).to(
          receive(:show).with(id: other_dataset_id).and_return(other_dataset_response)
        )
        allow(Api[:idah].dataset.entries).to receive(:index_all).and_return([])
      end

      it "creates multiple datasets in UPD file" do
        exporter.export(context)

        dataset_calls = updcli_calls.select { |c|
          parsed_args(c).include?("dataset") && parsed_args(c).include?("create")
        }
        expect(dataset_calls.size).to eq(2)
      end
    end

    context "when executor command fails" do
      before do
        allow(mock_executor).to receive(:call).and_raise(
          Executor::ExecutionError.new("updcli-static failed with stderr output")
        )
      end

      it "raises an ExecutionError" do
        expect {
          exporter.export(context)
        }.to raise_error(Executor::ExecutionError, /updcli-static failed/)
      end
    end

    context "when executor times out" do
      before do
        allow(mock_executor).to receive(:call).and_raise(
          Executor::TimeoutError.new("Command timed out after 300s")
        )
      end

      it "raises a TimeoutError" do
        expect {
          exporter.export(context)
        }.to raise_error(Executor::TimeoutError, /timed out/)
      end
    end

    context "empty datasets" do
      let(:context) { Exports::Context.new(mock_job, [dataset_id], options) }

      before do
        allow(Api[:idah].dataset.entries).to receive(:index_all).and_return([])
      end

      it "creates dataset without entries" do
        exporter.export(context)

        dataset_calls = updcli_calls.select { |c|
          parsed_args(c).include?("dataset") && parsed_args(c).include?("create")
        }
        entry_calls = updcli_calls.select { |c| parsed_args(c).include?("entry") && parsed_args(c).include?("create") }
        expect(dataset_calls).not_to be_empty
        expect(entry_calls).to be_empty
      end
    end

    context "entries without annotations" do
      before do
        allow(Api[:idah].dataset.annotations).to receive(:index_all).and_return([])
      end

      it "creates entries without annotations" do
        exporter.export(context)

        ann_calls = updcli_calls.select { |c|
          parsed_args(c).include?("annotation") && parsed_args(c).include?("create")
        }
        expect(ann_calls).to be_empty
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
