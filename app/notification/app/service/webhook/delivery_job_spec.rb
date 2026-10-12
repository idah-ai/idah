# frozen_string_literal: true

require "spec_helper"

RSpec.describe Webhook::DeliveryJob, database: true do
  let(:webhooks) { Webhook::Repository.new(Verse::Auth::Context[:system]) }
  let(:jobs) { Jobs::Repository.new(Verse::Auth::Context[:system]) }
  let(:secret) { "whsec_#{"a" * 64}" }
  let(:url) { "https://93.184.216.34/hook" }
  let(:body) { { nonce: 42, event: "dataset.project.updated", resource_id: "7", payload: { project: { name: "P" } } } }

  let(:webhook_id) do
    webhooks.create(
      {
        account_id: 3, role_name: "user", name: "Hook", url:, secret:,
        events: ["dataset.project.updated"], enabled: true
      }
    )
  end

  let(:job_id) do
    jobs.create(
      {
        job_class: "Webhook::DeliveryJob",
        arguments: { webhook_id:, body: },
        webhook_id:,
        status: "running",
        scheduled_at: Time.now
      }
    )
  end

  # Runs the job like the scheduler does and returns the commands it emitted.
  def run_job
    commands = []
    described_class.new(job_id, jobs.find!(job_id).arguments).run { |command, **opts| commands << [command, opts] }
    commands
  end

  it "posts the signed body and records the response" do
    stub_request(:post, url).to_return(status: 200, body: "ok")

    expect(run_job).to be_empty

    expect(
      a_request(:post, url).with { |request|
        timestamp = request.headers["X-Timestamp"]
        expected = OpenSSL::HMAC.hexdigest("sha256", secret, "#{timestamp}.#{request.body}")

        request.headers["Content-Type"] == "application/json" &&
          request.headers["X-Signature"] == "sha256=#{expected}" &&
          (Time.now.to_i - timestamp.to_i).abs < 5 &&
          JSON.parse(request.body, symbolize_names: true) == body
      }
    ).to have_been_made.once

    job = jobs.find!(job_id)
    expect(job.http_code).to eq 200
    expect(job.response).to eq "ok"
  end

  it "reports non-2xx responses as errors so the job is retried" do
    stub_request(:post, url).to_return(status: 500, body: "boom")

    expect(run_job).to eq [[:error, { error: "HTTP 500" }]]
    expect(jobs.find!(job_id).http_code).to eq 500
    expect(jobs.find!(job_id).response).to eq "boom"
  end

  it "reports connection failures as errors" do
    stub_request(:post, url).to_timeout

    expect(run_job.dig(0, 0)).to eq :error
    expect(jobs.find!(job_id).http_code).to be_nil
  end

  it "truncates long responses to 4 KB" do
    stub_request(:post, url).to_return(status: 200, body: "x" * 10_000)

    run_job

    expect(jobs.find!(job_id).response.bytesize).to eq 4096
  end

  it "doesn't send when the webhook was disabled after the job was queued" do
    webhooks.update!(webhook_id, { enabled: false })

    expect(run_job).to be_empty
    expect(a_request(:post, url)).not_to have_been_made
  end

  it "doesn't send when the webhook was deleted" do
    job_id
    webhooks.delete!(webhook_id)

    expect { described_class.new(job_id, { webhook_id:, body: }).run { |*| nil } }.not_to raise_error
    expect(a_request(:post, url)).not_to have_been_made
  end

  it "re-checks the URL at send time" do
    allow(Resolv).to receive(:getaddresses).and_return(["10.0.0.5"])

    expect(run_job.dig(0, 0)).to eq :error
    expect(a_request(:post, url)).not_to have_been_made
  end
end
