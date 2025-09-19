# frozen_string_literal: true

require "spec_helper"

RSpec.describe EntriesExpo, type: :exposition, as: :system do
  let(:now) { Time.now.utc }

  let(:uuid) { UUIDv7.generate }

  let(:entry_record) do
    Entry::Record.new(
      {
        id: uuid,
        priority: 1,
        wf_step: "start",
        status: "pending",
        assigned_to_id: 1,
        created_at: now,
        updated_at: now
      }
    )
  end

  let(:entry_data) do
    {
      data:
        {
          type: Resource::Dataset::Entries,
          id: uuid,
          attributes: {
            priority: 1,
            assigned_to_id: 1,
            created_at: now.iso8601,
            updated_at: now.iso8601
          }
        }
    }
  end

  let(:service) { instance_double(Entry::Service) }

  before do
    allow(Entry::Service).to receive(:new).and_return(service)
  end

  it "index" do
    expect(service).to receive(:index).and_return([entry_record])
    get "/entries"
    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    record = deserialize(body)
    expect(record[0].id).to eq uuid
    expect(record[0].status).to eq "pending"
  end

  it "show" do
    expect(service).to receive(:show).with(uuid, included: []).and_return(entry_record)
    get "/entries/#{uuid}"
    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    record = deserialize(body)
    expect(record.id).to eq uuid
    expect(record.status).to eq "pending"
  end

  it "create" do
    expect(service).to receive(:create).and_return(entry_record)
    post "/entries", entry_data

    expect(last_response.status).to eq 201
  end

  it "update" do
    expect(service).to receive(:update) do |args|
      expect(args.id).to eq uuid
      expect(args.attributes[:priority]).to eq 1
      entry_record
    end

    patch "/entries/#{uuid}", entry_data
    expect(last_response.status).to eq 200
  end

  it "assign member" do
    expect(service).to receive(:assign_member) do |args|
      expect(args.attributes[:assigned_to_id]).to eq 1
      entry_record
    end

    patch "/entries/#{uuid}/assign", {
      data: {
        type: Resource::Dataset::Entries,
        id: uuid,
        attributes: {
          assigned_to_id: 1,
        }
      }
    }
    expect(last_response.status).to eq 200
  end

  it "destroy" do
    expect(service).to receive(:delete).with(uuid).and_return(true)
    delete "/entries/#{uuid}"

    expect(last_response.status).to eq 204
  end
end
