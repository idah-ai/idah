# frozen_string_literal: true

require "spec_helper"
require_relative "../../../app/service/exports/entry_context"

Api[:idah].register(
  :dataset, :annotations, :index_all
) do |params = {}|
  Api.all(params) do |p|
    output = get(
      "dataset/annotations",
      params: p,
      options: { auth: :bearer }
    )
    deserialize(output.body)
  end
end

RSpec.describe Exports::EntryContext do
  let(:entry_id) { "019b2ad6-017f-7c32-aa1d-082f54fca92d" }
  let(:annotations_json) { File.read("app/sync/app/spec_data/api_data/annotations.json") }

  subject { described_class.new(entry_id) }

  before do
    Api[:idah].base_url = "http://idah.test/api/v1"

    stub_request(:post, "http://idah.test/api/v1/iam/auth/login").
      to_return(
        status: 200,
        body: JSON.generate(
          meta: {
            token: "test.eyJleHAiOjE3ODA3MzMyODB9.test"
          }
        ),
        headers: { 'Content-Type': 'application/json' }
      )
  end

  describe "#annotations" do
    it "returns an array of annotations" do
      stub_request(:get, "http://idah.test/api/v1/dataset/annotations?filter[entry_id]=#{entry_id}&included=project_members&page[number]=1&page[size]=1000").
        to_return(
          status: 200,
          body: annotations_json,
          headers: { 'Content-Type': 'application/json' }
        )

      annotations = subject.annotations
      expect(annotations).to be_an(Array)
      expect(annotations.size).to eq(1)
      expect(annotations.first).to be_a(Verse::JsonApi::Record)
      expect(annotations.first.id).to eq("019b2aec-94ff-7b50-bb44-8a3675e266f3")
    end
  end
end
