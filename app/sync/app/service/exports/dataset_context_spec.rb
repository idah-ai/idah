# frozen_string_literal: true

require_relative "../../spec_helper"

RSpec.describe Exports::DatasetContext do
  let(:dataset_id) { "019bba87-7810-7935-a8ae-d2a6bacebecb" }

  let(:dataset_response) { double("dataset", id: dataset_id) }
  let(:entry_response) { double("entry", id: "entry-1") }

  before do
    allow(Api[:idah].dataset.datasets).to receive(:show).with(id: dataset_id).and_return(dataset_response)
    allow(Api[:idah].dataset.entries).to receive(:index_all).and_return([entry_response])
  end

  describe "#entries" do
    let(:context) { described_class.new(dataset_id) }

    it "requests entries of the dataset" do
      context.entries

      expect(Api[:idah].dataset.entries).to have_received(:index_all)
        .with(filter: { dataset_id: }, included: [])
    end

    it "restricts to the given entry_ids when provided" do
      described_class.new(dataset_id, %w[e1 e2]).entries

      expect(Api[:idah].dataset.entries).to have_received(:index_all)
        .with(filter: { dataset_id:, id: %w[e1 e2] }, included: [])
    end

    it "merges additional filters (e.g. completed_entries) with the entry_ids" do
      described_class.new(dataset_id, %w[e1 e2]).entries(status: "completed")

      expect(Api[:idah].dataset.entries).to have_received(:index_all)
        .with(filter: { dataset_id:, id: %w[e1 e2], status: "completed" }, included: [])
    end

    it "keeps the plain status filter when no entry_ids are given" do
      context.entries(status: "completed")

      expect(Api[:idah].dataset.entries).to have_received(:index_all)
        .with(filter: { dataset_id:, status: "completed" }, included: [])
    end

    it "wraps entries in EntryContext" do
      result = context.entries

      expect(result).to all(be_a(Exports::EntryContext))
    end
  end
end
