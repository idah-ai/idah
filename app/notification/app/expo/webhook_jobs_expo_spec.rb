# frozen_string_literal: true

require "spec_helper"

RSpec.describe WebhookJobsExpo, type: :exposition, database: true do
  let(:webhooks) { Webhook::Repository.new(Verse::Auth::Context[:system]) }
  let(:jobs) { Jobs::Repository.new(Verse::Auth::Context[:system]) }

  def create_webhook(account_id:)
    webhooks.create(
      {
        account_id:,
        role_name: "user",
        name: "Hook",
        url: "https://93.184.216.34/hook",
        secret: "whsec_#{"a" * 64}",
        events: ["dataset.project.updated"]
      }
    )
  end

  def create_job(webhook_id)
    jobs.create(
      {
        job_class: "Webhook::DeliveryJob",
        arguments: { webhook_id:, body: { event: "dataset.project.updated" } },
        webhook_id:,
        status: "errored",
        retry_count: 8,
        error: "HTTP 500",
        http_code: 500,
        response: "boom",
        scheduled_at: Time.now
      }
    )
  end

  def response_records
    deserialize(JSON.parse(last_response.body, symbolize_names: true)).data
  end

  it "lists the deliveries of the caller's webhook" do
    webhook_id = create_webhook(account_id: 3)
    job_id = create_job(webhook_id)
    create_job(create_webhook(account_id: 3))

    as_user(:user) { get "/webhooks/#{webhook_id}/jobs" }

    expect(last_response.status).to eq 200
    records = response_records
    expect(records.map(&:id)).to eq [job_id]
    expect(records.first.status).to eq "errored"
    expect(records.first.http_code).to eq 500
    expect(records.first.response).to eq "boom"
    expect(records.first.error).to eq "HTTP 500"
    expect(records.first.retry_count).to eq 8
  end

  it "shows one delivery" do
    webhook_id = create_webhook(account_id: 3)
    job_id = create_job(webhook_id)

    as_user(:user) { get "/webhooks/#{webhook_id}/jobs/#{job_id}" }

    expect(last_response.status).to eq 200
  end

  it "hides deliveries of other accounts' webhooks" do
    webhook_id = create_webhook(account_id: 4)
    job_id = create_job(webhook_id)

    as_user(:user) { get "/webhooks/#{webhook_id}/jobs" }
    expect(response_records).to be_empty

    as_user(:user) { get "/webhooks/#{webhook_id}/jobs/#{job_id}" }
    expect(last_response.status).to eq 404
  end
end
