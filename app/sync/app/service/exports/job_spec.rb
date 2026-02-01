# frozen_string_literal: true

RSpec.describe Exports::Job do
  let(:mock_updated_by) do
    Verse::Auth::Context[:system]
  end

  let(:mock_job) do
    double(
      id: 1,
      arguments: {
        options: { format: "json" },
        dataset_ids: [1, 2],
        class: "Exports::TestExporter"
      },
      created_by: 0,
    )
  end

  let(:test_exporter_class) do
    Class.new do
      def initialize
      end

      def export(context)
        context.io.file.write("mock data")
        # Mock export implementation
      end
    end
  end

  before do
    stub_const("Exports::TestExporter", test_exporter_class)
  end

  subject { described_class.new(mock_job) }

  describe "#run_impl" do
    pending "initializes Export::Context and runs the export" do
      expect(Exports::Context).to receive(:new).with(
        subject,
        [1, 2],
        { format: "json" }
      ).and_call_original

      mock_context = instance_double("Exports::Context")
      allow(Exports::Context).to receive(:new).and_return(mock_context)

      subject.run_impl
    end
  end
end
