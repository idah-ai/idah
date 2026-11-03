# frozen_string_literal: true

require "spec_helper"

RSpec.describe EntryStatsExpo, type: :exposition, as: :system do
  let(:now) { Time.now.utc }
  let(:uuid) { UUIDv7.generate }
  let(:entry_id) { UUIDv7.generate }
  let(:dataset_id) { UUIDv7.generate }

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

  describe "#compute_stats_on_annotation_updated" do
    let(:annotation_id) { UUIDv7.generate }

    it "calls service.recompute_from_annotation with the correct arguments" do
      expect(service).to receive(:recompute_from_annotation).with(
        entry_id: entry_id,
        dataset_id: dataset_id,
        new_category: "dog"
      )

      Verse.publish_resource_event(
        resource_type: Resource::Dataset::Annotations,
        resource_id: annotation_id,
        event: "updated",
        payload: {
          resource_id: annotation_id,
          metadata: { old_category: "cat", entry_id: entry_id, dataset_id: dataset_id },
          args: [{ category: "dog" }]
        }
      )
    end

    it "does not call service when the annotation update has no category change" do
      expect(service).not_to receive(:recompute_from_annotation)

      Verse.publish_resource_event(
        resource_type: Resource::Dataset::Annotations,
        resource_id: annotation_id,
        event: "updated",
        payload: {
          resource_id: annotation_id,
          metadata: { old_category: "cat", entry_id: entry_id, dataset_id: dataset_id },
          args: [{ shape_type: "idah-image:polygon" }]
        }
      )
    end
  end

  describe "#recompute_stats_on_labeling_config_updated" do
    let(:dataset_id) { UUIDv7.generate }

    it "recomputes all stats for the dataset when categories are removed" do
      expect(service).to receive(:recompute_all_for_dataset).with(dataset_id, changed_category_ids: ["cat"])

      Verse.publish_resource_event(
        resource_type: Resource::Dataset::Datasets,
        resource_id: dataset_id,
        event: "labeling_configuration_updated",
        payload: {
          resource_id: dataset_id,
          metadata: { changed_category_ids: ["cat"] }
        }
      )
    end

    it "recomputes all stats when categories are added back" do
      expect(service).to receive(:recompute_all_for_dataset).with(dataset_id, changed_category_ids: ["dog"])

      Verse.publish_resource_event(
        resource_type: Resource::Dataset::Datasets,
        resource_id: dataset_id,
        event: "labeling_configuration_updated",
        payload: {
          resource_id: dataset_id,
          metadata: { changed_category_ids: ["dog"] }
        }
      )
    end

    it "does not recompute when the dataset update did not touch labeling configuration" do
      expect(service).not_to receive(:recompute_all_for_dataset)

      Verse.publish_resource_event(
        resource_type: Resource::Dataset::Datasets,
        resource_id: dataset_id,
        event: "updated",
        payload: { resource_id: dataset_id, metadata: {} }
      )
    end

    it "does not recompute on a generic 'updated' event (no listener)" do
      expect(service).not_to receive(:recompute_all_for_dataset)

      Verse.publish_resource_event(
        resource_type: Resource::Dataset::Datasets,
        resource_id: dataset_id,
        event: "updated",
        payload: {
          resource_id: dataset_id,
          metadata: { labeling_configuration_updated: false }
        }
      )
    end
  end
end
