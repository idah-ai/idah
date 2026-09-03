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
    let(:dataset_id) { "019bba87-7810-7935-a8ae-d2a6bacebecb" }
    let(:entry_id) { "019bba87-9818-7967-8233-35fa9807d8fa" }
    let(:annotation_id) { "019b2aec-94ff-7b50-bb44-8a3675e266f3" }
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
    let(:mock_file) { instance_double(File, close: true) }

    # Shared blocks for capturing JSONL writes
    let(:jsonl_writes) { @jsonl_writes ||= [] }
    let(:jsonl_data) { @jsonl_data ||= "".dup }

    let(:stdin_mock) do
      double("stdin").tap do |mock|
        allow(mock).to receive(:write_nonblock) do |data|
          @jsonl_data << data
          # Simulate writing the full line at once (default behaviour)
          captured_line = data.dup
          (@jsonl_writes ||= []) << captured_line if data.end_with?("\n")
          data.bytesize
        end
        allow(mock).to receive(:close)
      end
    end

    # Default: both pipes return EOF immediately (subprocess produced nothing)
    let(:stdout_mock) do
      double("stdout").tap do |mock|
        allow(mock).to receive(:read_nonblock).with(4096, exception: false).and_return(nil)
      end
    end

    let(:stderr_mock) do
      double("stderr").tap do |mock|
        allow(mock).to receive(:read_nonblock).with(4096, exception: false).and_return(nil)
      end
    end

    let(:exit_status_mock) { double("exit_status", success?: true) }
    let(:wait_thr_mock) { double("wait_thread", value: exit_status_mock) }

    before do
      @jsonl_writes = []
      @jsonl_data = "".dup

      # Stub ENV
      allow(ENV).to receive(:fetch).with("IDAH_URL").and_return("http://localhost:3000/")

      # Stub API calls
      allow(Api[:idah].dataset.datasets).to receive(:show).with(id: dataset_id).and_return(dataset_response)
      allow(Api[:idah].dataset.entries).to receive(:index_all).and_return([entry_response])
      allow(Api[:idah].dataset.annotations).to receive(:index_all).and_return([annotation_response])
      allow(Api[:idah].media.medias).to receive(:index_all).and_return([media_response])
      allow(Api[:idah].media.medias).to receive(:files).and_return(media_binary_data)

      # Stub File operations - prevent actual file opening
      allow(File).to receive(:open).and_call_original
      allow(File).to receive(:open).with(%r{/tmp/idah-export-\d+\.upd}).and_return(mock_file)

      # -- IO.select stubs for SubprocessIO --
      #
      # We match by timeout (10 is ours, 0/+inf are Ruby's/etc.) and dispatch
      # based on whether stdin is in the write array.
      allow(IO).to receive(:select) do |_read, write, _error, timeout|
        next unless timeout == 10 # only intercept our calls

        if write == [stdin_mock]
          # write_jsonl: default = stdin writable, no output to drain
          [[], [stdin_mock], []]
        else
          # read_remaining_output: default = both pipes ready (EOF immediately)
          [[stdout_mock, stderr_mock], [], []]
        end
      end

      # Stub Open3.popen3 to capture JSONL lines written to stdin
      allow(Open3).to receive(:popen3)
        .with("updcli-static", "--input", anything, "append")
        .and_yield(stdin_mock, stdout_mock, stderr_mock, wait_thr_mock)

      # Media tempfile stub – used when include_medias triggers download_media
      media_mock = double("media_tempfile")
      allow(media_mock).to receive(:binmode)
      allow(media_mock).to receive(:rewind)
      allow(media_mock).to receive(:path).and_return("/tmp/tempfile_media")
      allow(media_mock).to receive(:close!)
      allow(media_mock).to receive(:write)

      allow(Tempfile).to receive(:new).and_return(media_mock)
    end

    context "basic export flow" do
      it "sends init command as the first JSONL line via stdin" do
        exporter.export(context)

        first_line = @jsonl_writes.first
        expect(first_line).not_to be_nil
        parsed = JSON.parse(first_line)
        expect(parsed["command"]).to eq("init")
        expect(parsed["args"]).to eq({})
      end

      it "streams JSONL to updcli-static's stdin via Open3" do
        expect(Open3).to receive(:popen3)
          .with("updcli-static", "--input", anything, "append")
          .and_yield(stdin_mock, stdout_mock, stderr_mock, wait_thr_mock)
          .once

        exporter.export(context)
      end

      it "writes dataset JSONL line with correct fields" do
        exporter.export(context)

        dataset_line = @jsonl_writes.find { |l| l.include?("dataset:create") }
        expect(dataset_line).not_to be_nil
        parsed = JSON.parse(dataset_line)
        expect(parsed["command"]).to eq("dataset:create")
        expect(parsed["args"]["id"]).to eq(dataset_id)
        expect(parsed["args"]["name"]).to eq("Dataset 1")
        expect(parsed["args"]["modality"]).to eq("idah-video")
        expect(parsed["args"]["metadata"]).to be_a(String)
      end

      it "writes entry JSONL line with correct fields" do
        exporter.export(context)

        entry_line = @jsonl_writes.find { |l| l.include?("entry:create") }
        expect(entry_line).not_to be_nil
        parsed = JSON.parse(entry_line)
        expect(parsed["command"]).to eq("entry:create")
        expect(parsed["args"]["id"]).to eq(entry_id)
        expect(parsed["args"]["dataset_id"]).to eq(dataset_id)
        expect(parsed["args"]["url"]).to include("media/medias/files/4c2052a1475842e9.mov")
        expect(parsed["args"]["metadata"]).to be_a(String)
      end

      it "writes annotation JSONL line with correct fields" do
        exporter.export(context)

        annotation_line = @jsonl_writes.find { |l| l.include?("annotation:create") }
        expect(annotation_line).not_to be_nil
        parsed = JSON.parse(annotation_line)
        expect(parsed["command"]).to eq("annotation:create")
        expect(parsed["args"]["id"]).to eq(annotation_id)
        expect(parsed["args"]["entry_id"]).to eq(entry_id)
        expect(parsed["args"]["type"]).to eq("idah-video:bounding-box")
        expect(parsed["args"]["shape"]).to be_a(String)
        expect(parsed["args"]["annotation"]).to be_a(String)
        expect(parsed["args"]["metadata"]).to be_a(String)
      end

      it "sets the file to context.io" do
        exporter.export(context)
        expect(context.io.file).to eq(mock_file)
      end

      it "does not include media when include_medias option is absent" do
        exporter.export(context)

        media_lines = @jsonl_writes.select { |l| l.include?("media:create") }
        expect(media_lines).to be_empty
      end
    end

    context "annotation shape handling" do
      it "includes shape as inline JSON string (not @file)" do
        exporter.export(context)

        annotation_line = @jsonl_writes.find { |l| l.include?("annotation:create") }
        parsed = JSON.parse(annotation_line)
        shape = JSON.parse(parsed["args"]["shape"])
        expect(shape).to have_key("end")
        expect(shape).to have_key("start")
        expect(shape).not_to have_key("type") # type is separate top-level field
      end

      it "includes annotation data as inline JSON string" do
        exporter.export(context)

        annotation_line = @jsonl_writes.find { |l| l.include?("annotation:create") }
        parsed = JSON.parse(annotation_line)
        annotation = JSON.parse(parsed["args"]["annotation"])
        expect(annotation).to eq({ "category" => "vehicles/car" })
      end
    end

    context "media handling" do
      context "when include_medias option is not set" do
        let(:options) { {} }

        it "does not write any media JSONL lines" do
          exporter.export(context)
          media_lines = @jsonl_writes.select { |l| l.include?("media:create") }
          expect(media_lines).to be_empty
        end
      end

      context "when include_medias is 'original'" do
        let(:options) { { include_medias: "original" } }

        before do
          allow(Api[:idah].media.medias).to receive(:index_all).with(
            filter: { resource: "4c2052a1475842e9.mov", key: "" }
          ).and_return([media_response])
        end

        it "writes one media JSONL line for original media" do
          exporter.export(context)
          media_lines = @jsonl_writes.select { |l| l.include?("media:create") }
          expect(media_lines.size).to eq(1)
        end

        it "writes media with correct fields" do
          exporter.export(context)
          media_line = @jsonl_writes.find { |l| l.include?("media:create") }
          parsed = JSON.parse(media_line)
          expect(parsed["command"]).to eq("media:create")
          expect(parsed["args"]["id"]).to eq("4c2052a1475842e9.mov")
          expect(parsed["args"]["file"]).to be_a(String)
          expect(parsed["args"]["key"]).to eq("")
          expect(parsed["args"]["mimetype"]).to eq("video/quicktime")
        end
      end

      context "when include_medias is 'all'" do
        let(:options) { { include_medias: "all" } }

        it "writes a JSONL line for each media" do
          exporter.export(context)
          media_lines = @jsonl_writes.select { |l| l.include?("media:create") }
          expect(media_lines.size).to eq(1) # only 1 in fixture data currently
        end
      end

      context "media download" do
        let(:options) { { include_medias: "original" } }

        before do
          allow(Api[:idah].media.medias).to receive(:index_all).with(
            filter: { resource: "4c2052a1475842e9.mov", key: "" }
          ).and_return([media_response])
        end

        it "downloads media binary data" do
          expect(Api[:idah].media.medias).to receive(:files).with(
            resource: "4c2052a1475842e9.mov",
            key: ""
          ).and_return(media_binary_data)

          exporter.export(context)
        end
      end
    end

    context "entry URL handling" do
      context "when include_medias is 'original' or 'all'" do
        let(:options) { { include_medias: "original" } }

        it "uses local: prefix URL" do
          exporter.export(context)
          entry_line = @jsonl_writes.find { |l| l.include?("entry:create") }
          parsed = JSON.parse(entry_line)
          expect(parsed["args"]["url"]).to start_with("local:")
        end
      end

      context "when include_medias is not set" do
        let(:options) { {} }

        it "uses external URL via IDAH_URL" do
          exporter.export(context)
          entry_line = @jsonl_writes.find { |l| l.include?("entry:create") }
          parsed = JSON.parse(entry_line)
          expect(parsed["args"]["url"]).to start_with("http://localhost:3000/")
        end
      end
    end

    context "annotation metadata" do
      it "includes created-by, created-at, updated-at in metadata" do
        exporter.export(context)

        annotation_line = @jsonl_writes.find { |l| l.include?("annotation:create") }
        parsed = JSON.parse(annotation_line)
        metadata = JSON.parse(parsed["args"]["metadata"])

        expect(metadata["Created-By"]).to eq("admin@idah.ai")
        expect(metadata).to have_key("Created-At")
        expect(metadata).to have_key("Updated-At")
      end

      it "includes existing annotation metadata (confidence)" do
        exporter.export(context)

        annotation_line = @jsonl_writes.find { |l| l.include?("annotation:create") }
        parsed = JSON.parse(annotation_line)
        metadata = JSON.parse(parsed["args"]["metadata"])

        expect(metadata["Confidence"]).to eq(0.92)
      end
    end

    context "when append command fails" do
      let(:exit_status_mock) { double("exit_status", success?: false) }

      it "raises an exception with stderr output" do
        allow(stderr_mock).to receive(:read_nonblock)
          .with(4096, exception: false)
          .and_return("boom error\n", nil)

        # Override IO.select: return stderr readable on first write_jsonl call
        allow(IO).to receive(:select) do |_read, write, _error, timeout|
          next unless timeout == 10

          if write == [stdin_mock]
            [[stderr_mock], [], []]
          else
            [[stdout_mock, stderr_mock], [], []]
          end
        end

        expect {
          exporter.export(context)
        }.to raise_error(RuntimeError, /updcli-static append failed: boom error/)
      end
    end

    context "when updcli-static closes stdin (EPIPE)" do
      let(:exit_status_mock) { double("exit_status", success?: false) }

      it "surfaces the append failure instead of Errno::EPIPE" do
        # Simulate write_nonblock raising EPIPE on the first write
        allow(stdin_mock).to receive(:write_nonblock).and_raise(Errno::EPIPE, "Broken pipe")

        allow(IO).to receive(:select) do |_read, write, _error, timeout|
          next unless timeout == 10

          if write == [stdin_mock]
            [[], [stdin_mock], []]
          else
            [[stdout_mock, stderr_mock], [], []]
          end
        end

        expect {
          exporter.export(context)
        }.to raise_error(RuntimeError, /updcli-static append failed:/)
      end
    end

    context "stdout/stderr deadlock prevention" do
      it "drains subprocess output during write via IO.select multiplexing" do
        emitted_output = []
        on_output = ->(chunk, stream) { emitted_output << [chunk, stream] }

        call_count = 0
        allow(IO).to receive(:select) do |_read, write, _error, timeout|
          next unless timeout == 10

          if write == [stdin_mock]
            call_count += 1
            case call_count
            when 1 then [[stdout_mock], [stdin_mock], []]   # stdout + stdin
            when 2 then [[stderr_mock], [stdin_mock], []]   # stderr + stdin
            else        [[], [stdin_mock], []] # just stdin
            end
          else
            [[stdout_mock, stderr_mock], [], []]
          end
        end

        # stdout gives data then EOF, stderr gives data then EOF
        allow(stdout_mock).to receive(:read_nonblock)
          .with(4096, exception: false)
          .and_return("stdout-chunk\n", nil)

        allow(stderr_mock).to receive(:read_nonblock)
          .with(4096, exception: false)
          .and_return("stderr-chunk\n", nil)
        exporter.export(context, on_output: on_output)

        expect(emitted_output).to include(["stdout-chunk\n", :out])
        expect(emitted_output).to include(["stderr-chunk\n", :err])
      end

      it "handles premature output pipe closure gracefully" do
        allow(IO).to receive(:select) do |_read, write, _error, timeout|
          next unless timeout == 10

          if write == [stdin_mock]
            [[stdout_mock], [stdin_mock], []] # stdout readable (EOF)
          else
            [[stdout_mock, stderr_mock], [], []]
          end
        end

        # stdout returns nil (EOF) immediately -> subprocess closed its output
        allow(stdout_mock).to receive(:read_nonblock)
          .with(4096, exception: false)
          .and_return(nil)

        # StreamClosed is caught internally by export's rescue block.
        # The ensure runs, then wait_thr.value reports the exit status.
        # With a successful exit, export completes normally.
        expect { exporter.export(context) }.not_to raise_error
      end
    end

    context "large stdin input (>64KB pipe buffer)" do
      it "splits a large JSONL line across multiple write_nonblock calls" do
        huge_line = "#{"x" * (80 * 1024)}\n"

        # Stub the entry builder to return an artificially huge line (> 64KB)
        allow(exporter).to receive(:build_entry_jsonl).and_return(huge_line)

        call_count = 0
        allow(stdin_mock).to receive(:write_nonblock) do |data|
          call_count += 1
          # Simulate pipe buffer behavior: if data is too large for the buffer,
          # write only half and let the while loop retry with the remainder.
          if data.bytesize > 65_536
            data.bytesize / 2
          else
            data.bytesize
          end
        end

        allow(IO).to receive(:select) do |_read, write, _error, timeout|
          next unless timeout == 10

          if write == [stdin_mock]
            [[], [stdin_mock], []]
          else
            [[stdout_mock, stderr_mock], [], []]
          end
        end

        exporter.export(context)

        # The huge line forced an extra write_nonblock call (4 commands → 5 calls)
        expect(call_count).to be >= 5
      end
    end

    context "IO::WaitWritable on stdin" do
      it "retries write when pipe is temporarily full" do
        call_count = 0
        allow(stdin_mock).to receive(:write_nonblock) do |data|
          call_count += 1
          # Raise EAGAIN on first write attempt (the init line), succeed on retry
          raise IO::EAGAINWaitWritable, "Resource temporarily unavailable" if call_count == 1

          data.bytesize
        end

        allow(IO).to receive(:select) do |_read, write, _error, timeout|
          next unless timeout == 10

          if write == [stdin_mock]
            [[], [stdin_mock], []]
          else
            [[stdout_mock, stderr_mock], [], []]
          end
        end

        exporter.export(context)

        # First command (init) had a retry, so total calls >= commands count + 1
        expect(call_count).to be >= 5
      end
    end

    context "IO.select timeout in write_jsonl" do
      it "raises a timeout error when subprocess stalls" do
        allow(IO).to receive(:select) do |_read, write, _error, timeout|
          next unless timeout == 10

          if write == [stdin_mock]
            nil
          else
            [[stdout_mock, stderr_mock], [], []]
          end
        end

        expect {
          exporter.export(context)
        }.to raise_error(RuntimeError, /Timeout while waiting/)
      end
    end

    context "empty datasets" do
      before do
        allow(Api[:idah].dataset.entries).to receive(:index_all).and_return([])
      end

      it "writes dataset JSONL line but no entry lines" do
        exporter.export(context)

        dataset_lines = @jsonl_writes.select { |l| l.include?("dataset:create") }
        entry_lines = @jsonl_writes.select { |l| l.include?("entry:create") }

        expect(dataset_lines.size).to eq(1)
        expect(entry_lines).to be_empty
      end
    end

    context "entries without annotations" do
      before do
        allow(Api[:idah].dataset.annotations).to receive(:index_all).and_return([])
      end

      it "writes entry line but no annotation lines" do
        exporter.export(context)

        entry_lines = @jsonl_writes.select { |l| l.include?("entry:create") }
        annotation_lines = @jsonl_writes.select { |l| l.include?("annotation:create") }

        expect(entry_lines.size).to eq(1)
        expect(annotation_lines).to be_empty
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

    context "multiple datasets" do
      let(:other_dataset_id) { "019ba0dd-4beb-757b-b5fb-de54446534e1" }
      let(:context) { Exports::Context.new(mock_job, [dataset_id, other_dataset_id], options) }

      before do
        allow(Api[:idah].dataset.datasets).to receive(:show).with(id: other_dataset_id).and_return(dataset_response)
        allow(Api[:idah].dataset.entries).to receive(:index_all).and_return([])
      end

      it "writes dataset JSONL line for each dataset" do
        exporter.export(context)

        dataset_lines = @jsonl_writes.select { |l| l.include?("dataset:create") }
        expect(dataset_lines.size).to eq(2)
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
