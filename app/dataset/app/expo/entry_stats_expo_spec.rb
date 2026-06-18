# frozen_string_literal: true

require "spec_helper"

RSpec.describe EntryStatsExpo, type: :exposition, as: :system do
  let(:now) { Time.now.utc }
  let(:uuid) { UUIDv7.generate }
  let(:entry_id) { UUIDv7.generate }

  let(:stat_record) do
    EntryStat::Record.new(
      {
        id: uuid,
        entry_id: entry_id,
        key: "annotation.count",
        value: "5",
        created_at: now,
        updated_at: now
      }
    )
  end

  let(:service) { instance_double(EntryStats::Service) }

  before do
    allow(EntryStats::Service).to receive(:new).and_return(service)
  end

  it "index" do
    expect(service).to receive(:index).and_return([stat_record])
    get "/entry_stats"
    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    record = deserialize(body)
    expect(record[0].id).to eq uuid
    expect(record[0].key).to eq "annotation.count"
    expect(record[0].value).to eq "5"
  end

  it "show" do
    expect(service).to receive(:show).with(uuid, included: []).and_return(stat_record)
    get "/entry_stats/#{uuid}"
    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    record = deserialize(body)
    expect(record.id).to eq uuid
    expect(record.key).to eq "annotation.count"
  end

  describe "#compute_stats_on_entry_submitted" do
    it "calls service.recompute with the entry id from the event" do
      expect(service).to receive(:recompute).with(entry_id)

      Verse.publish_resource_event(
        resource_type: Resource::Dataset::Entries,
        resource_id: entry_id,
        event: "submitted",
        payload: { resource_id: entry_id }
      )
    end
  end

  describe "#compute_stats_on_entry_errored" do
    it "calls service.recompute with the entry id from the event" do
      expect(service).to receive(:recompute).with(entry_id)

      Verse.publish_resource_event(
        resource_type: Resource::Dataset::Entries,
        resource_id: entry_id,
        event: "errored",
        payload: { resource_id: entry_id }
      )
    end
  end
end
