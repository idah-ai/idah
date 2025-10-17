# frozen_string_literal: true

RSpec.describe Processor::Service, type: :service, database: false do
  subject { described_class.new(Verse::Auth::Context.new) }

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
            modality: "video" #  <-- Added modality
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
  end

  describe "#process_entry" do
    it "detect the entry type" do
      service.process_entry("entry-id")
    end
  end
end
