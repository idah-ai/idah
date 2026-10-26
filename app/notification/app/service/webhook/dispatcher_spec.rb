# frozen_string_literal: true

require "spec_helper"

RSpec.describe Webhook::Dispatcher, database: true do
  let(:webhooks) { Webhook::Repository.new(Verse::Auth::Context[:system]) }
  let(:jobs) { Jobs::Repository.new(Verse::Auth::Context[:system]) }
  let(:at) { "2026-10-12T08:00:00Z" }

  def create_webhook(events:, role_name: "user", enabled: true, account_id: 3)
    webhooks.create(
      {
        account_id:,
        role_name:,
        name: "Hook",
        url: "https://93.184.216.34/hook",
        secret: "whsec_#{"a" * 64}",
        events:,
        enabled:
      }
    )
  end

  def publish(resource_type, event, resource_id:, args: [], metadata: {})
    Verse.publish_resource_event(
      resource_type:,
      resource_id:,
      event:,
      payload: { args:, resource_id:, metadata: { at:, **metadata } }
    )
  end

  def stub_show(path, attributes)
    stub_request(:get, "http://idah.test/#{path}")
      .to_return(
        status: 200,
        body: JSON.generate(data: { type: "dataset:x", id: path.split("/").last, attributes: }),
        headers: { "Content-Type": "application/json" }
      )
  end

  # Params of each dataset access check made; the check allows every principal
  # except the ones in @denied_by_dataset.
  let(:dataset_checks) { [] }
  let(:sync_checks) { [] }

  before do
    Api[:idah].base_url = "http://idah.test"

    stub_request(:post, "http://idah.test/iam/auth/login")
      .to_return(
        status: 200,
        body: JSON.generate(data: {}, meta: { token: "test.eyJleHAiOjQxMDI0NDQ4MDB9.test" }),
        headers: { "Content-Type": "application/json" }
      )

    stub_request(:get, %r{\Ahttp://idah\.test/iam/accounts\?})
      .to_return(
        status: 200,
        body: JSON.generate(
          data: [
            { type: "iam:accounts", id: "1", attributes: { role_name: "admin", role_scope: {}, enabled: true } },
            {
              type: "iam:accounts", id: "2",
              attributes: { role_name: "org_owner", role_scope: { org: ["1"] }, enabled: true }
            },
            { type: "iam:accounts", id: "3", attributes: { role_name: "user", role_scope: {}, enabled: true } }
          ]
        ),
        headers: { "Content-Type": "application/json" }
      )

    stub_request(:post, "http://idah.test/sync/access/_rpc")
      .to_return do |request|
        params = JSON.parse(request.body, symbolize_names: true)[:params]
        sync_checks << params
        { status: 200, body: JSON.generate(
          jsonrpc: "2.0",
          result: { allowed: params[:principals].map {
            _1[:account_id]
          } },
          id: 1
        ) }
      end

    stub_request(:post, "http://idah.test/dataset/access/_rpc")
      .to_return do |request|
        params = JSON.parse(request.body, symbolize_names: true)[:params]
        dataset_checks << params
        allowed = params[:principals].map { _1[:account_id] } - (@denied_by_dataset || [])
        { status: 200, body: JSON.generate(jsonrpc: "2.0", result: { allowed: }, id: 1) }
      end
  end

  it "enqueues one delivery job per enabled webhook subscribed to the event, with the fetched resource" do
    id = create_webhook(events: ["dataset.project.updated"])
    stub_show("dataset/projects/7", { name: "Renamed", organization_id: 1 })

    publish("dataset:projects", "updated", resource_id: "7", args: [{ name: "Renamed" }])

    job = jobs.index({}).first
    expect(job.job_class).to eq "Webhook::DeliveryJob"
    expect(job.status).to eq "pending"
    expect(job.webhook_id).to eq id.to_i
    expect(job.arguments[:body]).to include(
      event: "dataset.project.updated",
      resource_id: "7",
      payload: { project: { name: "Renamed", organization_id: 1 } }
    )
    expect(job.arguments[:body][:nonce]).to be_a(Integer)
  end

  it "skips disabled, unsubscribed and role-not-allowed webhooks" do
    create_webhook(events: ["dataset.project.updated"], enabled: false)
    create_webhook(events: ["dataset.dataset.created"])
    create_webhook(events: ["dataset.project.created"], role_name: "user")

    publish("dataset:projects", "updated", resource_id: "7")
    publish("dataset:projects", "created", resource_id: "7")

    expect(jobs.index({}).count).to eq 0
  end

  it "doesn't fetch anything when no webhook is subscribed" do
    publish("dataset:projects", "updated", resource_id: "7")

    expect(a_request(:get, %r{dataset/projects})).not_to have_been_made
  end

  it "builds deleted-resource payloads from the event, without fetching" do
    create_webhook(events: ["dataset.project.deleted"], role_name: "org_owner", account_id: 2)

    publish("dataset:projects", "deleted", resource_id: "7", metadata: { organization_id: "1", project_id: "7" })

    expect(jobs.index({}).first.arguments[:body][:payload]).to eq(project: { id: "7", organization_id: "1" })
  end

  it "tells member removals and role changes apart on the same channel" do
    removed = create_webhook(events: ["dataset.project.member.removed"])
    role_updated = create_webhook(events: ["dataset.project.member.role_updated"])
    stub_show("dataset/project_members/5", { account_id: 4, role: "reviewer" })

    publish("dataset:project_members", "updated", resource_id: "5", args: [{ disabled_at: Time.now }])
    expect(jobs.index({}).map(&:webhook_id)).to eq [removed.to_i]

    publish("dataset:project_members", "updated", resource_id: "5", args: [{ role: "reviewer" }])
    expect(jobs.index({}).map(&:webhook_id)).to contain_exactly(removed.to_i, role_updated.to_i)
  end

  it "only sends entry.completed when the entry reaches the done step" do
    create_webhook(events: ["dataset.entry.completed"])
    stub_show("dataset/entries/9", { wf_step: "done" })

    publish("dataset:entries", "submitted", resource_id: "9", args: [{ wf_step: "review" }])
    expect(jobs.index({}).count).to eq 0

    publish("dataset:entries", "submitted", resource_id: "9", args: [{ wf_step: "done" }])
    expect(jobs.index({}).count).to eq 1
  end

  it "enqueues a duplicated event only once" do
    create_webhook(events: ["dataset.project.updated"])
    stub_show("dataset/projects/7", { name: "Renamed" })

    2.times { publish("dataset:projects", "updated", resource_id: "7") }

    expect(jobs.index({}).count).to eq 1
  end

  describe "permission checks" do
    it "asks dataset whether the owner can read the resource" do
      create_webhook(events: ["dataset.project.updated"])
      stub_show("dataset/projects/7", { name: "Renamed" })

      publish("dataset:projects", "updated", resource_id: "7")

      expect(dataset_checks).to contain_exactly(
        include(
          rule: "allowed",
          action: "read",
          resource: "dataset:projects",
          id: "7"
        )
      )
      expect(jobs.index({}).count).to eq 1
    end

    it "doesn't enqueue nor fetch when dataset denies every owner" do
      @denied_by_dataset = [3]
      create_webhook(events: ["dataset.project.updated"])

      publish("dataset:projects", "updated", resource_id: "7")

      expect(jobs.index({}).count).to eq 0
      expect(a_request(:get, %r{dataset/projects})).not_to have_been_made
    end

    it "checks deleted projects against the organization, without asking dataset" do
      create_webhook(events: ["dataset.project.deleted"], role_name: "org_owner", account_id: 2)

      publish("dataset:projects", "deleted", resource_id: "7", metadata: { organization_id: "2", project_id: "7" })

      expect(jobs.index({}).count).to eq 0
      expect(dataset_checks).to be_empty
    end

    it "lets project members only get member events about themselves" do
      create_webhook(events: ["dataset.project.member.added", "dataset.project.member.removed"])
      stub_show("dataset/project_members/5", { account_id: 3, role: "annotator" })

      publish(
        "dataset:project_members",
        "created",
        resource_id: "5",
        args: [{ account_id: 3 }],
        metadata: { project_id: "p1" }
      )
      publish(
        "dataset:project_members",
        "updated",
        resource_id: "5",
        args: [{ disabled_at: Time.now }],
        metadata: { project_id: "p1", project_member_account_id: 3 }
      )

      expect(dataset_checks).to contain_exactly(
        include(rule: "allowed", action: "update", resource: "dataset:project_members", id: "5", own_account_id: 3),
        include(rule: "allowed", action: "update", resource: "dataset:project_members", id: "5")
          .and(satisfy { !_1.key?(:own_account_id) })
      )
    end
  end

  describe "sync.export.completed" do
    def stub_exports(exports)
      stub_request(:get, %r{\Ahttp://idah\.test/sync/exports\?})
        .to_return(
          status: 200,
          body: JSON.generate(data: exports.map { { type: "sync:exports", id: _1[:id], attributes: _1.except(:id) } }),
          headers: { "Content-Type": "application/json" }
        )
    end

    before { create_webhook(events: ["sync.export.completed"]) }

    it "delivers the export of a finished export job to owners who can read it" do
      stub_exports([{ id: "42", job_id: "j1", project_id: "p1", filename: "export.zip", size: 10 }])

      publish("sync:jobs", "completed", resource_id: "j1")

      expect(sync_checks).to contain_exactly(
        include(
          rule: "allowed",
          action: "read",
          resource: "sync:exports",
          id: "42"
        )
      )
      body = jobs.index({}).first.arguments[:body]
      expect(body).to include(event: "sync.export.completed", resource_id: "j1")
      expect(body[:payload]).to eq(
        export: { id: "42", job_id: "j1", project_id: "p1", filename: "export.zip",
                  size: 10 }
      )
    end

    it "ignores finished jobs that aren't exports" do
      stub_exports([])

      publish("sync:jobs", "completed", resource_id: "j2")

      expect(sync_checks).to be_empty
      expect(jobs.index({}).count).to eq 0
    end
  end

  describe "IAM events" do
    let!(:admin_hook) do
      create_webhook(
        events: %w[iam.account.created iam.account.disabled iam.account.enabled iam.account.role_updated
                   iam.organization.created iam.organization.deleted
                   iam.organization.owner.added iam.organization.owner.removed],
        role_name: "admin",
        account_id: 1
      )
    end
    let!(:org_owner_hook) do
      create_webhook(
        events: %w[iam.organization.owner.added iam.organization.owner.removed],
        role_name: "org_owner",
        account_id: 2
      )
    end

    before do
      stub_request(:get, "http://idah.test/iam/accounts/9").to_return(
        status: 200,
        body: JSON.generate(data: { type: "iam:accounts", id: "9", attributes: { name: "New", role_name: "user" } }),
        headers: { "Content-Type": "application/json" }
      )
    end

    def account_updated(changes, previous)
      publish("iam:accounts", "updated", resource_id: "9", args: [changes], metadata: previous)
    end

    def delivered(webhook_id = nil)
      jobs.index({}).select { webhook_id.nil? || _1.webhook_id == webhook_id.to_i }
          .map { _1.arguments.dig(:body, :event) }
    end

    it "sends account.created to admins with the account from IAM" do
      publish("iam:accounts", "created", resource_id: "9")

      expect(delivered).to eq ["iam.account.created"]
      expect(jobs.index({}).first.arguments.dig(:body, :payload)).to eq(account: { name: "New", role_name: "user" })
    end

    it "sends account.disabled and account.enabled only on an actual change" do
      account_updated({ enabled: false }, { previous_enabled: true })
      account_updated({ enabled: false }, { previous_enabled: false })
      account_updated({ enabled: true }, { previous_enabled: false })
      account_updated({ enabled: true }, { previous_enabled: true })

      expect(delivered).to contain_exactly("iam.account.disabled", "iam.account.enabled")
    end

    it "sends account.role_updated only when the role changes" do
      account_updated({ role_name: "user" }, { previous_role_name: "user" })
      expect(delivered).to be_empty

      account_updated({ role_name: "admin" }, { previous_role_name: "user" })
      expect(delivered).to eq ["iam.account.role_updated"]
    end

    it "sends owner.added to admins and to owners of the added organizations" do
      account_updated(
        { role_name: "org_owner", role_scope: { org: %w[1 3] }.to_json },
        { previous_role_name: "user", previous_role_scope: {} }
      )

      expect(delivered(admin_hook)).to include("iam.organization.owner.added")
      expect(delivered(org_owner_hook)).to eq ["iam.organization.owner.added"]
      expect(jobs.index({ webhook_id: org_owner_hook }).first.arguments.dig(:body, :payload))
        .to include(organization_ids: %w[1 3])
    end

    it "sends owner.removed when organizations leave an org owner's scope, by edit or org deletion" do
      account_updated(
        { role_scope: { "org" => [] } },
        { previous_role_name: "org_owner",
          previous_role_scope: { "org" => ["1"] } }
      )

      expect(delivered(org_owner_hook)).to eq ["iam.organization.owner.removed"]
    end

    it "treats a demotion from org owner as removal from all its organizations" do
      account_updated(
        { role_name: "user" },
        { previous_role_name: "org_owner",
          previous_role_scope: { "org" => ["1"] } }
      )

      expect(delivered(org_owner_hook)).to eq ["iam.organization.owner.removed"]
    end

    it "doesn't send owner events to owners of other organizations" do
      account_updated(
        { role_name: "org_owner", role_scope: { org: ["3"] }.to_json },
        { previous_role_name: "user", previous_role_scope: {} }
      )

      expect(delivered(org_owner_hook)).to be_empty
    end

    it "sends organization events to admins" do
      stub_request(:get, "http://idah.test/iam/organizations/5").to_return(
        status: 200,
        body: JSON.generate(data: { type: "iam:organizations", id: "5", attributes: { name: "Acme" } }),
        headers: { "Content-Type": "application/json" }
      )

      publish("iam:organizations", "created", resource_id: "5")
      publish("iam:organizations", "deleted", resource_id: "5", metadata: { organization_id: "5" })

      expect(delivered).to contain_exactly("iam.organization.created", "iam.organization.deleted")
    end
  end

  describe "failures" do
    it "queues nothing for a handler whose owner lookup fails, and doesn't raise" do
      create_webhook(events: ["dataset.project.updated"])
      stub_show("dataset/projects/7", { name: "Renamed" })
      stub_request(:get, %r{\Ahttp://idah\.test/iam/accounts\?}).to_return(status: 500, body: "down")

      expect { publish("dataset:projects", "updated", resource_id: "7") }.not_to raise_error
      expect(jobs.index({}).count).to eq 0
    end
  end

  describe "account changes" do
    it "disables the owner's webhooks when the account is disabled, so nothing is sent" do
      owner_hook = create_webhook(events: ["dataset.project.updated"], account_id: 3)

      publish(
        "iam:accounts",
        "updated",
        resource_id: "3",
        args: [{ enabled: false }],
        metadata: { previous_enabled: true }
      )
      publish("dataset:projects", "updated", resource_id: "7")

      expect(webhooks.find!(owner_hook).enabled).to be false
      expect(jobs.index({}).count).to eq 0
    end

    it "leaves the owner's webhooks alone on updates that don't disable the account" do
      owner_hook = create_webhook(events: ["dataset.project.updated"], account_id: 3)

      publish(
        "iam:accounts",
        "updated",
        resource_id: "3",
        args: [{ name: "Renamed" }],
        metadata: { previous_enabled: true }
      )

      expect(webhooks.find!(owner_hook).enabled).to be true
    end

    it "disables, and keeps, the webhooks of a deleted account" do
      owner_hook = create_webhook(events: ["dataset.project.updated"], account_id: 3)

      publish("iam:accounts", "deleted", resource_id: "3")

      expect(webhooks.find(owner_hook)).not_to be_nil
      expect(webhooks.find!(owner_hook).enabled).to be false
    end
  end

  describe "dataset payloads" do
    it "delivers a created project with its attributes to admins" do
      create_webhook(events: ["dataset.project.created"], role_name: "admin", account_id: 1)
      stub_show("dataset/projects/7", { name: "New" })

      publish("dataset:projects", "created", resource_id: "7")

      expect(jobs.index({}).first.arguments.dig(:body, :payload)).to eq(project: { name: "New" })
    end

    it "delivers a completed dataset with its attributes" do
      create_webhook(events: ["dataset.dataset.completed"])
      stub_show("dataset/datasets/9", { name: "D" })

      publish("dataset:datasets", "completed", resource_id: "9")

      expect(jobs.index({}).first.arguments.dig(:body, :payload)).to eq(dataset: { name: "D" })
    end

    it "delivers a completed entry with its attributes" do
      create_webhook(events: ["dataset.entry.completed"])
      stub_show("dataset/entries/8", { wf_step: "done" })

      publish("dataset:entries", "submitted", resource_id: "8", args: [{ wf_step: "done" }])

      expect(jobs.index({}).first.arguments.dig(:body, :payload)).to eq(entry: { wf_step: "done" })
    end

    it "delivers a deleted dataset's id and project, since the row is gone" do
      create_webhook(events: ["dataset.dataset.deleted"])

      publish("dataset:datasets", "deleted", resource_id: "9", metadata: { project_id: "7" })

      expect(jobs.index({}).first.arguments.dig(:body, :payload)).to eq(dataset: { id: "9", project_id: "7" })
    end
  end
end
