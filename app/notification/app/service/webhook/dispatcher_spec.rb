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

  before do
    Api[:idah].base_url = "http://idah.test"

    stub_request(:post, "http://idah.test/iam/auth/login")
      .to_return(
        status: 200,
        body: JSON.generate(data: {}, meta: { token: "test.eyJleHAiOjQxMDI0NDQ4MDB9.test" }),
        headers: { "Content-Type": "application/json" }
      )
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
    create_webhook(events: ["dataset.project.deleted"], role_name: "org_owner")

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
end
