# frozen_string_literal: true

require "spec_helper"

RSpec.describe DatasetsExpo, type: :exposition, as: :system do
  let(:now) { Time.now.utc }

  let(:uuid) { UUIDv7.generate}

  let(:dataset_record) do
    Dataset::Record.new(
      {
        id: uuid,
        topology: "image_labeling",
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
          type: "dataset/datasets",
          id: uuid,
          attributes: {
            topology: "image_labeling",
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
    expect(record[0].topology).to eq "image_labeling"
  end

  it "show" do
    expect(service).to receive(:show).with(uuid, included: []).and_return(dataset_record)
    get "/datasets/#{uuid}"

    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    record = deserialize(body)
    expect(record.id).to eq uuid
    expect(record.topology).to eq "image_labeling"
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
end
