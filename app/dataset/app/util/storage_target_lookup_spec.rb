# frozen_string_literal: true

require "spec_helper"

RSpec.describe StorageTargetLookup do
  let(:target_id) { "0194f5a2-0000-7000-8000-000000000001" }
  let(:url) { %r{/api/v1/setting/storage_targets/#{target_id}\z} }
  let(:response) do
    {
      status: 200,
      headers: { "Content-Type" => "application/vnd.api+json" },
      body: {
        data: {
          type: "setting:storage_targets",
          id: target_id,
          attributes: {
            name: "Acme bucket", endpoint: "https://s3.example.com", bucket: "acme-bucket",
            enabled: true, organization_ids: [1, 2], secret_hint: "-123"
          }
        }
      }.to_json
    }
  end

  before do
    described_class.reset!
    WebMock::RequestRegistry.instance.reset!
    stub_request(:post, %r{/api/v1/iam/auth/login}).to_return(status: 200, body: %({ "data": {} }))
  end

  after { described_class.reset! }

  it "asks the setting service for a target, keeping what a project needs" do
    stub_request(:get, url).to_return(response)

    expect(described_class.find(target_id)).to eq(
      described_class::Target.new(
        id: target_id,
        name: "Acme bucket",
        endpoint: "https://s3.example.com",
        bucket: "acme-bucket",
        enabled: true,
        organization_ids: [1, 2]
      )
    )
  end

  it "is nil for a target setting doesn't serve: unknown or archived" do
    stub_request(:get, url).to_return(status: 404, body: %({ "errors": [] }))

    expect(described_class.find(target_id)).to be_nil
  end

  it "keeps an answer for a minute, for showing projects" do
    request = stub_request(:get, url).to_return(response)

    described_class.find(target_id)
    described_class.find(target_id)

    assert_requested(request, times: 1)
  end

  it "asks again when told to, as a project creation must" do
    request = stub_request(:get, url).to_return(response)

    described_class.find(target_id)
    described_class.find(target_id, fresh: true)

    assert_requested(request, times: 2)
  end

  it "lets other failures through" do
    stub_request(:get, url).to_return(status: 500, body: "{}")

    expect { described_class.find(target_id) }.to raise_error(Api::HTTPError)
  end
end
