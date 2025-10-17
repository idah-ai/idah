# frozen_string_literal: true

RSpec.describe Processor::Service, type: :service, database: true do
  subject { described_class.new(Verse::Auth::Context.new) }

  module Spec
    class SampleProcessor
    end
  end

  before do
    japi_entry = {
      data: {
        id: "entry-id",
        type: "entries",
        attributes: {
          priority: 1,
          wf_step: "processing",
          status: "ready",
          job_id: 123,
          resource: "some-resource-identifier",
          assigned_to_id: nil,
          created_at: "2023-10-27T10:00:00Z",
          updated_at: "2023-10-27T10:00:00Z"
        },
        relationships: {
          dataset: {
            data: {
              id: "dataset-id",
              type: "datasets"
            }
          }
        }
      },
      included: [
        {
          id: "dataset-id",
          type: "datasets",
          attributes: {
            name: "Test Dataset",
            modality: "spec/video" #  <-- Added modality
          }
        }
      ]
    }.to_json

    stub_request(
      :get,
      "https://idah.example.com/api/v1/entries/entry-id?included%5B%5D=dataset"
    ).to_return(
      status: 200,
      body: japi_entry,
      headers: { "Content-Type" => "application/json" },
    )

    # We don't really care about the return here; it should be the entry, but
    # our focus is on whether the entry was updated.
    stub_request(:patch, "https://idah.example.com/api/v1/entries/entry-id").
      to_return(status: 200, body: %{{ "data": {} }}, headers: {})
  end

  before do
    Processor::Registry.clear_all
    Processor::Registry.register(
      "plugin-video", "spec/video", Spec::SampleProcessor
    )
  end

  after do
    Processor::Registry.clear_all
  end

  describe "#process_entry" do
    it "detects the entry type" do
      service.process_entry("entry-id")
    end
  end
end
