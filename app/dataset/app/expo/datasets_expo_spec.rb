# frozen_string_literal: true

require "spec_helper"

RSpec.describe DatasetsExpo, type: :exposition, as: :system do
  let(:now) { Time.now.utc }

  let(:uuid) { UUIDv7.generate }

  let(:dataset_record) do
    Dataset::Record.new(
      {
        id: uuid,
        modality: "image_labeling",
        labels: ["cat", "dog"],
        configuration: { "width" => 100, "height" => 100 },
        status: "pending",
        progress: 0.0,
        project_id: 1,
        created_at: now,
        updated_at: now
      }
    )
  end

  let(:dataset_data) do
    {
      data:
        {
          type: Resource::Dataset::Datasets,
          id: uuid,
          attributes: {
            modality: "image_labeling",
            labels: ["cat", "dog"],
            configuration: { "width" => 100, "height" => 100 },
            status: "pending",
            progress: 0.0,
            project_id: 1,
            created_at: now.iso8601,
            updated_at: now.iso8601
          }
        }
    }
  end

  let(:service) { instance_double(Dataset::Service) }

  before do
    allow(Dataset::Service).to receive(:new).and_return(service)
  end

  it "index" do
    expect(service).to receive(:index).and_return([dataset_record])
    get "/datasets"

    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    record = deserialize(body)
    expect(record[0].id).to eq uuid
    expect(record[0].modality).to eq "image_labeling"
  end

  it "show" do
    expect(service).to receive(:show).with(uuid, included: []).and_return(dataset_record)
    get "/datasets/#{uuid}"

    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    record = deserialize(body)
    expect(record.id).to eq uuid
    expect(record.modality).to eq "image_labeling"
  end

  it "create" do
    expect(service).to receive(:create).and_return(dataset_record)
    post "/datasets", dataset_data

    expect(last_response.status).to eq 201
  end

  it "update" do
    expect(service).to receive(:update) do |args|
      expect(args.id).to eq uuid
      expect(args.attributes[:labels]).to eq ["cat", "dog"]
      dataset_record
    end

    patch "/datasets/#{uuid}", dataset_data
    expect(last_response.status).to eq 200
  end

  it "destroy" do
    expect(service).to receive(:delete).with(uuid).and_return(true)
    delete "/datasets/#{uuid}"

    expect(last_response.status).to eq 204
  end

  describe "PATCH /datasets/:id/feedback_configuration" do
    it "updates the feedback configuration" do
      new_config = {
        key1: { label: "Fix this", description: "It's broken" },
        key2: { label: "Great work" }
      }

      expect(service).to receive(:update_feedback_configuration)
        .with(uuid, new_config)
        .and_return(new_config)

      patch "/datasets/#{uuid}/feedback_configuration", { feedback_configuration: new_config }
      expect(last_response.status).to eq 200
    end
  end

  describe "GET /datasets/:id/feedback_keys_in_use" do
    it "returns keys referenced by notes" do
      expect(service).to receive(:feedback_keys_in_use)
        .with(uuid)
        .and_return({ keys: ["key1", "key3"] })

      get "/datasets/#{uuid}/feedback_keys_in_use"

      expect(last_response.status).to eq 200
      body = JSON.parse(last_response.body, symbolize_names: true)
      expect(body[:data][:keys]).to match_array(%w[key1 key3])
    end
  end
end
