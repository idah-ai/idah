# frozen_string_literal: true

require "spec_helper"

RSpec.describe AnnotationChangesExpo, type: :exposition, as: :system do
  let(:now) { Time.now.utc }
  let(:uuid) { "3f8b9c0-4d2e-11ec-bf63-0242ac130002" }

  let(:annotation_change_record) do
    AnnotationChange::Record.new(
      {
        id: uuid,
        annotation_id: "5f8b9c0-4d2e-11ec-bf63-1300020242ac",
        entry_id: 1,
        project_id: 1,
        account_id: 1,
        op: "updated",
        version: 2,
        changes: [["~", "category", "cat", "dog"]],
        changed_at: now
      }
    )
  end

  let(:annotation_record) do
    Annotation::Record.new(
      {
        id: "5f8b9c0-4d2e-11ec-bf63-1300020242ac",
        entry_id: 1,
        project_id: 1,
        dataset_id: 1,
        shape_type: "bounding-box",
        shape_args: { "x" => 10 },
        category: "cat",
        created_by_email: "user@example.com",
        created_at: now,
        updated_at: now,
        version: 2
      }
    )
  end

  let(:service) { instance_double(AnnotationChange::Service) }

  before do
    allow(AnnotationChange::Service).to receive(:new).and_return(service)
  end

  it "index" do
    expect(service).to receive(:index).and_return([annotation_change_record])
    get "/annotation_changes"
    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    record = deserialize(body)
    expect(record[0].id).to eq uuid
    expect(record[0].op).to eq "updated"
  end

  it "show" do
    expect(service).to receive(:show).with(uuid, included: []).and_return(annotation_change_record)
    get "/annotation_changes/#{uuid}"
    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    record = deserialize(body)
    expect(record.id).to eq uuid
  end
end
