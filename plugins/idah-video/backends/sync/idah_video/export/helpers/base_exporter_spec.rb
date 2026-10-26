# frozen_string_literal: true

require "spec_helper"

RSpec.describe IdahVideo::Export::Helpers::BaseExporter do
  it "leaves writing a dataset to the format's exporter" do
    dataset = FakeExportContext::Dataset.new(id: "ds-1", entries: [])
    context = FakeExportContext.new(datasets: [dataset])

    expect { described_class.new.export(context) }.to raise_error(NotImplementedError)
  ensure
    context&.cleanup
  end
end
