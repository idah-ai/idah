# frozen_string_literal: true

require "spec_helper"
require_relative "../../../app/service/exports/dataset_context"
require_relative "../../../app/service/exports/entry_context"

# Register the endpoint for the spec
Api[:idah].register(
  :dataset, :entries, :index_all
) do |params = {}|
  Api.all(params) do |p|
    output = get(
      "dataset/entries",
      params: p,
      options: { auth: :bearer }
    )
    deserialize(output.body)
  end
end

RSpec.describe Exports::DatasetContext do
  let(:dataset_id) { "019b4e62-ab2f-71aa-af3d-0f6e06bc1126" }
  let(:entries_json) { File.read("app/spec_data/api_data/entries.json") }

  subject { described_class.new(dataset_id) }

  before do
    Api[:idah].base_url = "http://idah.test"

    # Mock the login request to get a token
    stub_request(:post, "http://idah.test/iam/auth/login").
      with(
        body: { "email" => "sync@services.idah.ai", "password" => "password" }
      ).
      to_return(
        status: 200,
        body: JSON.generate(
          data: {},
          meta: {
            token: "test.eyJleHAiOjE3ODA3MzMyODB9.test"
          }
        ),
        headers: { 'Content-Type': "application/json" }
      )

    # The context loads its dataset on initialization
    stub_request(:get, "http://idah.test/dataset/datasets/#{dataset_id}").
      to_return(
        status: 200,
        body: JSON.generate(
          data: {
            type: "dataset:datasets",
            id: dataset_id,
            attributes: {
              name: "Dataset 1",
              modality: "idah-video"
            }
          }
        ),
        headers: { 'Content-Type': "application/json" }
      )
  end

  describe "#entries" do
    it "returns an array of EntryContext objects" do
      stub_request(
        :get,
        "http://idah.test/dataset/entries?filter%5Bdataset_id%5D=#{dataset_id}&page%5Bnumber%5D=1&page%5Bsize%5D=1000"
      ).
        to_return(
          status: 200,
          body: entries_json,
          headers: { 'Content-Type': "application/json" }
        )

      entries = subject.entries
      expect(entries).to be_an(Array)
      expect(entries.size).to eq(3)
      expect(entries.first).to be_a(Exports::EntryContext)
      expect(entries.first.record.id).to eq("019bba87-9818-7967-8233-35fa9807d8fa")
    end

    it "does not filter on the status when no filter is given" do
      expect(Api[:idah].dataset.entries).to receive(:index_all).with(
        filter: { dataset_id: },
        included: []
      ).and_return([])

      expect(subject.entries).to eq([])
    end

    it "merges the given filter with the dataset id" do
      expect(Api[:idah].dataset.entries).to receive(:index_all).with(
        filter: { status: "completed", dataset_id: },
        included: []
      ).and_return([])

      expect(subject.entries({ status: "completed" })).to eq([])
    end

    it "requests only the completed entries when filtering on the completed status" do
      url = "http://idah.test/dataset/entries?filter%5Bdataset_id%5D=#{dataset_id}" \
            "&filter%5Bstatus%5D=completed&page%5Bnumber%5D=1&page%5Bsize%5D=1000"

      stub = stub_request(:get, url).to_return(
        status: 200,
        body: entries_json,
        headers: { 'Content-Type': "application/json" }
      )

      entries = subject.entries({ status: "completed" })

      assert_requested(stub)
      expect(entries.size).to eq(3)
    end
  end
end
