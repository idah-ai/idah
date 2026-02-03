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
  let(:dataset_id) { "019ba0dd-4beb-757b-b5fb-de54446534e0" }

  subject { described_class.new(dataset_id) }

  before do
    Api[:idah].base_url = "http://idah.test"

    # Mock the login request to get a token
    stub_request(:post, "http://idah.test/iam/auth/login").
      with(
        body: {"email"=>"sync@services.idah.ai", "password"=>"password"}
      ).
      to_return(
        status: 200,
        body: JSON.generate(
          data: {

          },
          meta: {
            token: "test.eyJleHAiOjE3ODA3MzMyODB9.test"
          }
        ),
        headers: { 'Content-Type': 'application/json' }
      )
  end

  describe "#entries" do
    it "returns an array of EntryContext objects" do
      stub_request(:get,
      "http://idah.test/dataset/entries?filter[dataset_id]=019ba0dd-4beb-757b-b5fb-de54446534e0&page[number]=1&page[size]=1000").
        to_return(
          status: 200,
          body: JSON.generate({
            "data": [
              {
                "type": "dataset:entries",
                "id": "019ba0e7-e8c6-77ad-8965-18a63f52582d"
              },
              {
                "type": "dataset:entries",
                "id": "019ba0e8-05e5-711d-8a3e-8f4f4a7144a2"
              }
            ],
            "included": [],
            "meta": {
              "count": 2,
              "more": false
            }
          }),
          headers: { 'Content-Type': 'application/json' }
        )

      entries = subject.entries
      expect(entries).to be_an(Array)
      expect(entries.size).to eq(2)
      expect(entries.first).to be_a(Exports::EntryContext)
      expect(entries.first.id).to eq("019ba0e7-e8c6-77ad-8965-18a63f52582d")
    end
  end

  describe "#info" do
    it "is not implemented" do
      expect(subject.info).to be_nil
    end
  end
end
