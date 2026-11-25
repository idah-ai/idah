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

    it "doesn't publish the new webhook, whose event would carry the secret" do
      allow(Verse).to receive(:publish_resource_event).and_call_original

      as_user(:user) { post "/webhooks", payload(attributes) }

      expect(last_response.status).to eq 201
      expect(Verse).not_to have_received(:publish_resource_event)
        .with(hash_including(resource_type: Resource::Notification::Webhooks))
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

    it "validates events against the role the webhook was created with" do
      id = create_webhook(account_id: 2, role_name: "user")

      as_user(:org_owner) { patch "/webhooks/#{id}", payload({ events: ["dataset.project.created"] }, id:) }

      expect(last_response.status).to eq 422
      expect(system_repo.find!(id).events).to eq ["dataset.project.updated"]
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

    it "lists the events each role can subscribe to" do
      dataset_for_all = %w[
        dataset.project.updated dataset.project.member.added dataset.project.member.role_updated
        dataset.project.member.removed dataset.dataset.created dataset.dataset.deleted
        dataset.dataset.completed dataset.entry.completed
      ]
      org_level = %w[dataset.project.created dataset.project.deleted
                     iam.organization.owner.added iam.organization.owner.removed]
      admin_only = %w[iam.account.created iam.account.disabled iam.account.enabled iam.account.role_updated
                      iam.organization.created iam.organization.deleted]

      as_user(:user) { get "/webhooks/events" }
      expect(event_ids).to match_array(dataset_for_all + ["sync.export.completed"])

      as_user(:org_owner) { get "/webhooks/events" }
      expect(event_ids).to match_array(dataset_for_all + org_level + ["sync.export.completed"])

      as_user(:admin) { get "/webhooks/events" }
      expect(event_ids).to match_array(dataset_for_all + org_level + admin_only + ["sync.export.completed"])
    end

    it "describes each event" do
      as_user(:admin) { get "/webhooks/events" }

      event = response_records.find { _1.id == "dataset.project.member.removed" }
      expect(event.type).to eq "notification:webhook_events"
      expect(event.event).to eq "dataset:project_members:updated"
      expect(event.label).to eq "Project Member Removed"
      expect(event.allowed_roles).to eq %w[admin org_owner user]

      added = response_records.find { _1.id == "dataset.project.member.added" }
      expect(added.event).to eq "dataset:project_members:created"
    end
  end

  describe "POST /webhooks/:id/test" do
    let(:jobs) { Jobs::Repository.new(Verse::Auth::Context[:system]) }

    def result
      JSON.parse(last_response.body, symbolize_names: true)
    end

    it "sends a signed ping to the receiver right away and returns its response, even when disabled" do
      id = create_webhook(account_id: 3, role_name: "user", enabled: false)
      stub_request(:post, public_url).to_return(status: 200, body: "pong")

      as_user(:user) { post "/webhooks/#{id}/test" }

      expect(last_response.status).to eq 200
      expect(result).to eq(http_code: 200, success: true, response: "pong")
      expect(
        a_request(:post, public_url).with { |request|
          body = JSON.parse(request.body, symbolize_names: true)
          body[:event] == "ping" && body[:resource_id] == id.to_s &&
            request.headers["X-Signature"]&.start_with?("sha256=")
        }
      ).to have_been_made.once
    end

    it "reports a failing receiver without retrying" do
      id = create_webhook(account_id: 3, role_name: "user")
      stub_request(:post, public_url).to_return(status: 500, body: "boom")

      as_user(:user) { post "/webhooks/#{id}/test" }

      expect(result).to eq(http_code: 500, success: false, response: "boom")
      expect(a_request(:post, public_url)).to have_been_made.once
    end

    it "doesn't record the ping in the delivery log" do
      id = create_webhook(account_id: 3, role_name: "user")
      stub_request(:post, public_url).to_return(status: 200, body: "pong")

      as_user(:user) { post "/webhooks/#{id}/test" }

      expect(jobs.index({ webhook_id: id })).to be_empty
    end

    it "reports an unreachable receiver" do
      id = create_webhook(account_id: 3, role_name: "user")
      stub_request(:post, public_url).to_timeout

      as_user(:user) { post "/webhooks/#{id}/test" }

      expect(result[:http_code]).to be_nil
      expect(result[:success]).to be false
      expect(result[:response]).to include("Timeout")
    end

    it "cannot test other accounts' webhooks" do
      id = create_webhook(account_id: 4, role_name: "user")

      as_user(:user) { post "/webhooks/#{id}/test" }

      expect(last_response.status).to eq 404
      expect(a_request(:post, public_url)).not_to have_been_made
    end
  end
end
