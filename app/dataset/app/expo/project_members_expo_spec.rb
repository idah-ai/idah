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

  it "accepts the project_id__in filter and passes it to the service" do
    # If :project_id__in were removed from allowed_filters this request would 400.
    expect(service).to receive(:index).with(
      hash_including(project_id__in: [uuid]),
      included: [],
      page: 1,
      items_per_page: 1000,
      sort: nil,
      query_count: false
    ).and_return([project_member_record])

    get "/project_members?filter[project_id__in][]=#{uuid}"

    expect(last_response.status).to eq 200
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

  it "invite members to a project" do
    expect(service).to receive(:invite).with(
      uuid,
      members: [{ "email" => "a@test.com",
                  "role" => "annotator" }]
    ).and_return([project_member_record])
    post "/project_members/invite", { project_id: uuid, members: [{ email: "a@test.com", role: "annotator" }] }

    expect(last_response.status).to eq 200
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

  it "invite members to a project" do
    expect(service).to receive(:invite).with(
      uuid,
      members: [{ "email" => "a@test.com",
                  "role" => "annotator" }]
    ).and_return([project_member_record])
    post "/project_members/invite", { project_id: uuid, members: [{ email: "a@test.com", role: "annotator" }] }

    expect(last_response.status).to eq 200
  end

  it "renders per-index invite errors with the right pointers" do
    errors = Object.new
    errors.define_singleton_method(:errors) do
      {
        "members/0" => ["invalid role `superuser`"],
        "members/1" => ["This account is already an active member of the project"]
      }
    end
    expect(service).to receive(:invite).and_raise(Verse::Error::ValidationFailed, errors)

    post "/project_members/invite",
         {
           project_id: uuid,
           members: [
             { email: "a@test.com", role: "superuser" },
             { email: "b@test.com", role: "annotator" }
           ]
         }

    expect(last_response.status).to eq 422
    body = JSON.parse(last_response.body, symbolize_names: true)
    pointers = body[:errors].map { |e| e[:source][:pointer] }
    expect(pointers).to include("/members/0", "/members/1")
  end

  it "resend a project member invitation" do
    expect(service).to receive(:resend_invitation).with("1").and_return(project_member_record)
    post "/project_members/1/resend_invitation"

    expect(last_response.status).to eq 200
  end

  describe "#on_account_deleted" do
    it "deletes all project members for the deleted account, propagating the actor" do
      resource_id = 42
      metadata = {
        actor_account_id: 7,
        actor_account_email: "admin@example.com",
        actor_account_role_name: "admin"
      }
      expect(service).to(receive(:delete_account_members).with(resource_id, metadata))

      Verse.publish_resource_event(
        resource_type: Resource::Iam::Accounts,
        resource_id:,
        event: "deleted",
        payload: { resource_id:, metadata: }
      )
    end
  end

  describe "#on_account_updated" do
    it "disables all project members for the disabled account, propagating the actor" do
      resource_id = 42
      metadata = {
        actor_account_id: 7,
        actor_account_email: "admin@example.com",
        actor_account_role_name: "admin"
      }
      expect(service).to(receive(:disable_account_members).with(resource_id, metadata))

      Verse.publish_resource_event(
        resource_type: Resource::Iam::Accounts,
        resource_id:,
        event: "updated",
        payload: {
          resource_id:,
          args: [{ enabled: false }],
          metadata:
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

    it "does not disable project members if the enabled param is nil" do
      resource_id = 42
      expect(service).not_to(receive(:disable_account_members))

      Verse.publish_resource_event(
        resource_type: Resource::Iam::Accounts,
        resource_id:,
        event: "updated",
        payload: {
          resource_id:,
          args: []
        }
      )
    end
  end
end
