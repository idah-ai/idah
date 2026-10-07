# frozen_string_literal: true

require "spec_helper"

RSpec.describe WebhooksExpo, type: :exposition, database: true do
  let(:system_repo) { Webhook::Repository.new(Verse::Auth::Context[:system]) }

  # Public IP literal: passes the SSRF check without DNS.
  let(:public_url) { "https://93.184.216.34/hook" }

  def create_webhook(account_id:, role_name:, name: "Hook", enabled: false)
    system_repo.create(
      {
        account_id:,
        role_name:,
        name:,
        url: public_url,
        secret: "whsec_#{"a" * 60}wxyz",
        events: ["dataset.project.updated"],
        enabled:
      }
    )
  end

  def payload(attributes, id: nil)
    { data: { type: Resource::Notification::Webhooks, id: id&.to_s, attributes: }.compact }
  end

  def response_record
    deserialize(JSON.parse(last_response.body, symbolize_names: true))
  end

  def response_records
    response_record.data
  end

  describe "POST /webhooks" do
    let(:attributes) do
      { name: "My hook", url: public_url, events: ["dataset.project.updated", "dataset.entry.completed"] }
    end

    it "creates a disabled webhook owned by the caller's account and role, returning the full secret" do
      as_user(:user) { post "/webhooks", payload(attributes) }

      expect(last_response.status).to eq 201
      record = response_record
      expect(record.account_id).to eq 3
      expect(record.role_name).to eq "user"
      expect(record.events).to eq ["dataset.project.updated", "dataset.entry.completed"]
      expect(record.enabled).to be false
      expect(record.secret).to match(/\Awhsec_\h{64}\z/)
    end

    it "ignores ownership and secret sent in the body" do
      as_user(:user) do
        post "/webhooks", payload({ **attributes, account_id: 99, role_name: "admin", secret: "mine" })
      end

      expect(last_response.status).to eq 201
      record = response_record
      expect(record.account_id).to eq 3
      expect(record.role_name).to eq "user"
      expect(record.secret).not_to eq "mine"
    end

    it "rejects unknown events" do
      as_user(:user) { post "/webhooks", payload({ **attributes, events: ["dataset.nope"] }) }

      expect(last_response.status).to eq 422
    end

    it "rejects events not allowed for the caller's role" do
      as_user(:user) { post "/webhooks", payload({ **attributes, events: ["dataset.project.created"] }) }

      expect(last_response.status).to eq 422
    end

    it "rejects an empty event list" do
      as_user(:user) { post "/webhooks", payload({ **attributes, events: [] }) }

      expect(last_response.status).to eq 422
    end

    it "rejects private and non-http URLs" do
      ["http://10.0.0.5/hook", "http://169.254.169.254/", "ftp://93.184.216.34/"].each do |url|
        as_user(:user) { post "/webhooks", payload({ **attributes, url: }) }

        expect(last_response.status).to eq(422), url
      end
    end

    it "rejects anonymous callers" do
      as_user(:anonymous) { post "/webhooks", payload(attributes) }

      expect(last_response.status).to be_between(401, 403)
    end
  end

  describe "GET /webhooks" do
    before do
      create_webhook(account_id: 3, role_name: "user", name: "Mine")
      create_webhook(account_id: 3, role_name: "org_owner", name: "Mine, previous role")
      create_webhook(account_id: 4, role_name: "user", name: "Someone else's")
    end

    it "lists only the caller's webhooks for their current role, with masked secrets" do
      as_user(:user) { get "/webhooks" }

      expect(last_response.status).to eq 200
      records = response_records
      expect(records.map(&:name)).to eq ["Mine"]
      expect(records.first.secret).to eq "whsec_aaaa...wxyz"
    end
  end

  describe "GET /webhooks/:id" do
    it "shows the caller's webhook with a masked secret" do
      id = create_webhook(account_id: 3, role_name: "user")

      as_user(:user) { get "/webhooks/#{id}" }

      expect(last_response.status).to eq 200
      expect(response_record.secret).to eq "whsec_aaaa...wxyz"
    end

    it "hides other accounts' webhooks" do
      id = create_webhook(account_id: 4, role_name: "user")

      as_user(:user) { get "/webhooks/#{id}" }

      expect(last_response.status).to eq 404
    end
  end

  describe "PATCH /webhooks/:id" do
    it "updates the webhook and keeps ownership and secret immutable" do
      id = create_webhook(account_id: 3, role_name: "user")

      as_user(:user) do
        patch "/webhooks/#{id}", payload({ name: "Renamed", enabled: true, role_name: "admin", secret: "mine" }, id:)
      end

      expect(last_response.status).to eq 200
      record = response_record
      expect(record.name).to eq "Renamed"
      expect(record.enabled).to be true
      expect(record.role_name).to eq "user"
      expect(system_repo.find!(id).secret).to eq "whsec_#{"a" * 60}wxyz"
    end

    it "refuses to enable a webhook created under another role" do
      id = create_webhook(account_id: 3, role_name: "org_owner")

      as_user(:user) { patch "/webhooks/#{id}", payload({ enabled: true }, id:) }

      expect(last_response.status).to eq 422
      expect(system_repo.find!(id).enabled).to be false
    end

    it "validates events and url" do
      id = create_webhook(account_id: 3, role_name: "user")

      as_user(:user) { patch "/webhooks/#{id}", payload({ url: "http://127.0.0.1/" }, id:) }
      expect(last_response.status).to eq 422

      as_user(:user) { patch "/webhooks/#{id}", payload({ events: ["dataset.project.deleted"] }, id:) }
      expect(last_response.status).to eq 422
    end

    it "cannot update other accounts' webhooks" do
      id = create_webhook(account_id: 4, role_name: "user")

      as_user(:user) { patch "/webhooks/#{id}", payload({ name: "Hijacked" }, id:) }

      expect(last_response.status).to eq 404
      expect(system_repo.find!(id).name).to eq "Hook"
    end
  end

  describe "DELETE /webhooks/:id" do
    it "deletes the caller's webhook" do
      id = create_webhook(account_id: 3, role_name: "user")

      as_user(:user) { delete "/webhooks/#{id}" }

      expect(last_response.status).to eq 204
      expect(system_repo.find(id)).to be_nil
    end

    it "cannot delete other accounts' webhooks" do
      id = create_webhook(account_id: 4, role_name: "user")

      as_user(:user) { delete "/webhooks/#{id}" }

      expect(last_response.status).to eq 404
      expect(system_repo.find(id)).not_to be_nil
    end
  end

  describe "GET /webhooks/events" do
    def event_ids
      response_records.map(&:id)
    end

    it "lists the dataset events allowed for the caller's role" do
      as_user(:user) { get "/webhooks/events" }

      expect(last_response.status).to eq 200
      expect(event_ids).to include("dataset.project.updated", "dataset.entry.completed")
      expect(event_ids).not_to include("dataset.project.created", "dataset.project.deleted")
    end

    it "lists every dataset event for an org owner" do
      as_user(:org_owner) { get "/webhooks/events" }

      expect(event_ids).to contain_exactly(
        "dataset.project.created",
        "dataset.project.updated",
        "dataset.project.deleted",
        "dataset.project.member.added",
        "dataset.project.member.role_updated",
        "dataset.project.member.removed",
        "dataset.dataset.created",
        "dataset.dataset.deleted",
        "dataset.dataset.completed",
        "dataset.entry.completed"
      )
    end

    it "describes each event" do
      as_user(:admin) { get "/webhooks/events" }

      event = response_records.find { _1.id == "dataset.project.member.removed" }
      expect(event.type).to eq "notification:webhook_events"
      expect(event.event).to eq "dataset:project_members:updated"
      expect(event.label).to eq "Project Member Removed"
      expect(event.allowed_roles).to eq %w[admin org_owner user]
    end
  end
end
