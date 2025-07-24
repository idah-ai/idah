# frozen_string_literal: true

require "spec_helper"

RSpec.describe AnnotationsExpo, type: :exposition, as: :system do
  let(:now) { Time.now.utc }

  let(:annotation_record) do
    Annotation::Record.new(
      {
        id: 1,
        entry_id: 1,
        dataset_id: 1,
        type: "bounding_box",
        dimensions: { "x" => 10, "y" => 20, "width" => 30, "height" => 40 },
        annotation: { "label" => "cat" },
        created_by_id: 1,
        created_at: now,
        updated_at: now
      }
    )
  end

  let(:annotation_data) do
    {
      data:
        {
          type: "annotations",
          id: "1",
          attributes: {
            type: "bounding_box",
            entry_id: 1,
            dimensions: { "x" => 10, "y" => 20, "width" => 30, "height" => 40 },
            annotation: { "label" => "cat" },
            created_at: now.iso8601,
            updated_at: now.iso8601
          }
        }
    }
  end

  let(:service) { instance_double(Annotation::Service) }

  before do
    allow(Annotation::Service).to receive(:new).and_return(service)
  end

  it "index" do
    expect(service).to receive(:index).and_return([annotation_record])
    get "/annotations"
    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    record = deserialize(body)
    expect(record[0].id).to eq "1"
    expect(record[0].type).to eq "bounding_box"
  end

  it "show" do
    expect(service).to receive(:show).with(1, included: []).and_return(annotation_record)
    get "/annotations/1"
    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    record = deserialize(body)
    expect(record.id).to eq "1"
    expect(record.type).to eq "bounding_box"
  end

  it "create" do
    expect(service).to receive(:create).and_return(annotation_record)
    post "/annotations", annotation_data

    expect(last_response.status).to eq 201
  end

  it "update" do
    expect(service).to receive(:update) do |args|
      expect(args.id).to eq 1
      expect(args.attributes[:annotation]).to eq({ label: "cat" })
      annotation_record
    end

    patch "/annotations/1", annotation_data
    expect(last_response.status).to eq 200
  end

  it "destroy" do
    expect(service).to receive(:delete).with(1).and_return(true)
    delete "/annotations/1"

    expect(last_response.status).to eq 204
  end

  describe "JSON-RPC" do
    let(:rpc_endpoint) { "/annotations/_rpc" }

    def rpc_call(command)
      post rpc_endpoint, command, { "CONTENT_TYPE" => "application/json" }
    end

    def rpc_cmd(method, params)
      @id ||= 0

      {
        jsonrpc: "2.0",
        method: method,
        params: params,
        id: (@id += 1)
      }
    end

    def rpc_batch_call(calls)
      post "/annotations/rpc", calls, { "CONTENT_TYPE" => "application/json" }
    end

    it "show" do
      expect(service).to receive(:show).with(1).and_return(annotation_record)
      rpc_call rpc_cmd("show", { id: 1 })

      expect(last_response.status).to eq 200
      body = JSON.parse(last_response.body, symbolize_names: true)
      expect(body[:result][:id]).to eq 1
    end

    it "create" do
      expect(service).to receive(:create).and_return(annotation_record)

      rpc_call rpc_cmd("create", annotation_data[:data][:attributes])

      expect(last_response.status).to eq 200
    end

    it "update" do
      expect(service).to receive(:update_attr).with(1, anything).and_return(annotation_record)

      rpc_call rpc_cmd("update", { id: 1, **annotation_data[:data][:attributes] })

      expect(last_response.status).to eq 200
    end

    it "delete" do
      expect(service).to receive(:delete).with(1).and_return(true)

      rpc_call rpc_cmd("delete", { id: 1 })

      expect(last_response.status).to eq 200
    end

    it "batch" do
      expect(service).to receive(:show).with(1).and_return(annotation_record)
      expect(service).to receive(:show).with(2).and_return(annotation_record)

      rpc_call [
        rpc_cmd("show", { id: 1 }),
        rpc_cmd("show", { id: 2 })
      ]

      expect(last_response.status).to eq 200
      body = JSON.parse(last_response.body, symbolize_names: true)
      expect(body.size).to eq(2)
    end
  end
end
