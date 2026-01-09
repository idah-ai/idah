# frozen_string_literal: true

require "spec_helper"

RSpec.describe ProjectMembersExpo, type: :exposition, as: :system do
  let(:now) { Time.now.utc }

  let(:uuid) { UUIDv7.generate }

  let(:project_member_record) do
    ProjectMember::Record.new(
      {
        id: 1,
        project_id: uuid,
        account_id: 1,
        role: "annotator",
        invited_by_id: 1,
        created_at: now,
        updated_at: now
      }
    )
  end

  let(:project_member_data) do
    {
      data: {
        type: Resource::Dataset::ProjectMembers,
        id: "1",
        attributes: {
          project_id: uuid,
          account_id: 1,
          email: "annotator@email.com",
          role: "annotator",
          invited_by_id: 1,
        }
      }
    }
  end

  let(:service) { instance_double(ProjectMember::Service) }

  before do
    allow(ProjectMember::Service).to receive(:new).and_return(service)
  end

  it "list a project members" do
    expect(service).to receive(:index).and_return([project_member_record])
    get "/project_members"

    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    records = deserialize(body)

    expect(records[0].id).to eq "1"
    expect(records[0].account_id).to eq 1
    expect(records[0].role).to eq "annotator"
  end

  it "show a project member" do
    expect(service).to receive(:show).with(1, included: []).and_return(project_member_record)
    get "/project_members/1"

    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    record = deserialize(body)

    expect(record.id).to eq "1"
    expect(record.account_id).to eq 1
    expect(record.role).to eq "annotator"
  end

  it "create a project member" do
    expect(service).to receive(:create).and_return(project_member_record)
    post "/project_members", project_member_data

    expect(last_response.status).to eq 201
    body = JSON.parse(last_response.body, symbolize_names: true)
    created_record = deserialize(body)

    expect(created_record.id).to eq "1"
    expect(created_record.account_id).to eq 1
    expect(created_record.role).to eq "annotator"
  end

  it "update a project member" do
    expect(service).to receive(:update) do |args|
      expect(args.id).to eq 1
      # expect(args.attributes["role"]).to eq "annotator"
      project_member_record
    end

    patch "/project_members/1", project_member_data
    expect(last_response.status).to eq 200
  end

  it "delete a project member" do
    expect(service).to receive(:delete).with(1).and_return(true)
    delete "/project_members/1"

    expect(last_response.status).to eq 204
  end

  describe "#on_account_deleted" do
    it "deletes all project members for the deleted account" do
      resource_id = 42
      expect(service).to(receive(:delete_account_members).with(resource_id))

      Verse.publish_resource_event(
        resource_type: Resource::Iam::Accounts,
        resource_id:,
        event: "deleted",
        payload: { resource_id: }
      )
    end
  end

  describe "#on_account_updated" do
    it "disables all project members for the disabled account" do
      resource_id = 42
      expect(service).to(receive(:disable_account_members).with(resource_id))

      Verse.publish_resource_event(
        resource_type: Resource::Iam::Accounts,
        resource_id:,
        event: "updated",
        payload: {
          resource_id:,
          args: [{ enabled: false }]
        }
      )
    end

    it "does not disable project members if the account is still enabled" do
      resource_id = 42
      expect(service).not_to(receive(:disable_account_members))

      Verse.publish_resource_event(
        resource_type: Resource::Iam::Accounts,
        resource_id:,
        event: "updated",
        payload: {
          resource_id:,
          args: [{ enabled: true }]
        }
      )
    end
  end
end
