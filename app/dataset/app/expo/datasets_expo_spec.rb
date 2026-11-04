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

  describe "Delivery Date HTTP contract" do
    [:post, :patch].each do |verb|
      context "on #{verb}" do
        let(:path) { verb == :post ? "/datasets" : "/datasets/#{uuid}" }
        let(:action) { verb == :post ? :create : :update }

        it "rejects an invalid date before calling the service" do
          expect(service).not_to receive(action)
          public_send(
            verb,
            path,
            { data: { type: Resource::Dataset::Datasets,
                      attributes: { delivery_date: "2030-02-30" } } }
          )
          expect(last_response.status).to eq(422)
        end

        ["2030-01-02", nil].each do |value|
          it "accepts delivery_date #{value.inspect}" do
            date = value && Date.iso8601(value)
            expect(service).to receive(action) do |record|
              expect(record.attributes).to have_key(:delivery_date)
              expect(record.attributes[:delivery_date]).to eq(date)
              Dataset::Record.new(dataset_record.fields.merge(delivery_date: date))
            end
            public_send(
              verb,
              path,
              { data: { type: Resource::Dataset::Datasets,
                        attributes: { delivery_date: value } } }
            )
            expect(last_response.status).to eq(verb == :post ? 201 : 200)
            expect(JSON.parse(last_response.body).dig("data", "attributes", "delivery_date")).to eq(value)
          end
        end

        it "does not turn an omitted date into explicit null" do
          expect(service).to receive(action) do |record|
            expect(record.attributes).not_to have_key(:delivery_date)
            dataset_record
          end
          public_send(verb, path, { data: { type: Resource::Dataset::Datasets, attributes: { name: "Unrelated" } } })
          expect(last_response.status).to eq(verb == :post ? 201 : 200)
        end
      end
    end
  end

  it "destroy" do
    expect(service).to receive(:delete).with(uuid).and_return(true)
    delete "/datasets/#{uuid}"

    expect(last_response.status).to eq 204
  end
end
