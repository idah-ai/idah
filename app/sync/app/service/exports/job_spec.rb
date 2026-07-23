# frozen_string_literal: true

RSpec.describe Exports::Job do
  let(:mock_updated_by) do
    Verse::Auth::Context[:system]
  end

  let(:export_options) { { format: "json" } }
  let(:dataset_ids) { [1, 2] }
  let(:exporter_class_name) { "Exports::TestExporter" }
  let(:job_id) { 1 }
  let(:export_id) { 123 }
  let(:job_arguments) do
    {
      options: export_options,
      dataset_ids: dataset_ids,
      exporter: exporter_class_name,
      export_id: export_id
    }
  end

  let(:test_exporter_class) do
    Class.new do
      def initialize; end

      def export(context)
        context.io.file.write("mock data")
        # Mock export implementation
      end
    end
  end

  let(:mock_export_context) { instance_double(Exports::Context) }
  let(:mock_io_context) { instance_double(Exports::IoContext) }
  let(:mock_file) { instance_double(File, rewind: nil, write: nil) }
  let(:mock_exports_service) { Exports::Service.new(Verse::Auth::Context.new) }
  let(:mock_export_record) { double(id: export_id) }

  before do
    stub_const("Exports::TestExporter", test_exporter_class)

    allow(Exports::Context).to receive(:new).and_return(mock_export_context)
    allow(mock_export_context).to receive(:io).and_return(mock_io_context)
    allow(mock_io_context).to receive(:file).and_return(mock_file)
    allow(mock_io_context).to receive(:cleanup)

    allow(Exports::Service).to receive(:new).and_return(mock_exports_service)
    allow(mock_exports_service).to receive(:show).with(export_id).and_return(mock_export_record)
    allow(mock_exports_service).to receive(:upload).with(any_args)
  end

  subject { described_class.new(job_id, job_arguments) }

  describe "#run_impl" do
    context "with file mode" do
      before do
        allow(mock_io_context).to receive(:mode).and_return(:file)
        allow(mock_io_context).to receive(:file).and_return(mock_file)
      end

      it "initializes Export::Context with correct parameters" do
        expect(Exports::Context).to receive(:new).with(
          subject,
          dataset_ids,
          export_options
        ).and_return(mock_export_context)

        subject.run_impl
      end

      it "constantizes and instantiates the exporter class" do
        exporter_instance = instance_double("Exports::TestExporter")
        expect(Exports::TestExporter).to receive(:new).and_return(exporter_instance)
        expect(exporter_instance).to receive(:export).with(mock_export_context)

        subject.run_impl
      end

      it "rewinds the file and uploads it" do
        expect(mock_file).to receive(:rewind)
        expect(mock_exports_service).to receive(:upload).with(mock_export_record.id, mock_file)

        subject.run_impl
      end

      it "looks up export by export_id from arguments" do
        expect(mock_exports_service).to receive(:show).with(export_id).and_return(mock_export_record)

        subject.run_impl
      end

      it "ensures cleanup is called" do
        expect(mock_io_context).to receive(:cleanup)

        subject.run_impl
      end
    end

    context "with dir mode" do
      let(:mock_zip_file) { instance_double("File") }

      before do
        allow(mock_io_context).to receive(:mode).and_return(:dir)
        allow(mock_io_context).to receive(:zip_directory).and_return(mock_zip_file)
      end

      it "zips the directory and uploads it" do
        expect(mock_io_context).to receive(:zip_directory).and_return(mock_zip_file)
        expect(mock_exports_service).to receive(:upload).with(mock_export_record.id, mock_zip_file)

        subject.run_impl
      end

      it "ensures cleanup is called" do
        expect(mock_io_context).to receive(:cleanup)

        subject.run_impl
      end
    end

    context "with invalid mode" do
      before do
        allow(mock_io_context).to receive(:mode).and_return(:invalid)
      end

      it "raises an error for invalid IO mode" do
        expect { subject.run_impl }.to raise_error("Invalid IO mode: invalid")
      end

      it "still ensures cleanup is called on error" do
        expect(mock_io_context).to receive(:cleanup)

        expect { subject.run_impl }.to raise_error("Invalid IO mode: invalid")
      end
    end

    context "when exporter raises an error" do
      before do
        allow(mock_io_context).to receive(:mode).and_return(:file)
        allow(mock_io_context).to receive(:file).and_return(mock_file)

        exporter_instance = instance_double("Exports::TestExporter")
        allow(Exports::TestExporter).to receive(:new).and_return(exporter_instance)
        allow(exporter_instance).to receive(:export).and_raise(StandardError, "Export failed")
      end

      it "ensures cleanup is called even when export fails" do
        expect(mock_io_context).to receive(:cleanup)

        expect { subject.run_impl }.to raise_error(StandardError, "Export failed")
      end
    end

    context "when exporter class doesn't exist" do
      let(:exporter_class_name) { "Exports::NonExistentExporter" }

      it "raises an error for non-existent exporter class" do
        expect { subject.run_impl }.to raise_error(NameError)
      end

      it "ensures cleanup is called even when constantization fails" do
        expect(mock_io_context).to receive(:cleanup)

        expect { subject.run_impl }.to raise_error(NameError)
      end
    end

    context "with different export options" do
      let(:export_options) { { format: "csv", compression: true } }

      it "passes custom options to the context" do
        expect(Exports::Context).to receive(:new).with(
          subject,
          dataset_ids,
          export_options
        ).and_return(mock_export_context)

        allow(mock_io_context).to receive(:mode).and_return(:file)
        allow(mock_io_context).to receive(:file).and_return(mock_file)

        subject.run_impl
      end
    end

    context "with empty dataset_ids" do
      let(:dataset_ids) { [] }

      before do
        allow(mock_io_context).to receive(:mode).and_return(:file)
        allow(mock_io_context).to receive(:file).and_return(mock_file)
      end

      it "initializes context with empty dataset_ids and completes successfully" do
        expect(Exports::Context).to receive(:new).with(
          subject,
          [],
          export_options
        ).and_return(mock_export_context)

        subject.run_impl
      end
    end

    context "integration with Exports::Service" do
      before do
        allow(mock_io_context).to receive(:mode).and_return(:file)
        allow(mock_io_context).to receive(:file).and_return(mock_file)
      end

      it "creates Exports::Service with system auth context" do
        expect(Exports::Service).to receive(:new) do |auth_context|
          expect(auth_context).to be_a(Verse::Auth::Context)
          mock_exports_service
        end

        subject.run_impl
      end

      it "caches the exports service instance" do
        # Call run_impl which will access exports service multiple times
        subject.run_impl

        # Verify Service.new was called only once (due to memoization)
        expect(Exports::Service).to have_received(:new).once
      end
    end
  end
end
