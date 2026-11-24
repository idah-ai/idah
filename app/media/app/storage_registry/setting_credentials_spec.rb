# frozen_string_literal: true

require "spec_helper"

# StorageRegistry::SettingCredentials lives in common/lib; it is specced here,
# where the registry it feeds is.
RSpec.describe StorageRegistry::SettingCredentials do
  let(:target_id) { "0194f5a2-0000-7000-8000-000000000001" }
  let(:url) { "https://idah.example.com/api/v1/setting/storage_targets/#{target_id}/_credentials" }

  before do
    stub_request(:post, "https://idah.example.com/api/v1/iam/auth/login")
      .to_return(status: 200, body: %({ "data": {} }))
  end

  it "fetches a target's location and credentials from the setting service" do
    stub_request(:get, url).to_return(
      status: 200,
      headers: { "Content-Type" => "application/vnd.api+json" },
      body: {
        data: {
          type: Resource::Setting::StorageTargets,
          id: target_id,
          attributes: {
            endpoint: "https://s3.example.com",
            region: "eu-west-1",
            bucket: "customer-bucket",
            prefix: "acme",
            access_key_id: "AKIAEXAMPLE",
            secret_access_key: "LEAK-CANARY-123"
          }
        }
      }.to_json
    )

    expect(described_class.call(target_id)).to eq(
      endpoint: "https://s3.example.com",
      region: "eu-west-1",
      bucket: "customer-bucket",
      prefix: "acme",
      access_key_id: "AKIAEXAMPLE",
      secret_access_key: "LEAK-CANARY-123"
    )
  end

  it "returns nil for a target the setting service doesn't know, so the registry reports it unavailable" do
    stub_request(:get, url).to_return(status: 404, body: %({ "errors": [] }))

    expect(described_class.call(target_id)).to be_nil
  end

  it "lets other failures through" do
    stub_request(:get, url).to_return(status: 403, body: %({ "errors": [] }))

    expect { described_class.call(target_id) }.to raise_error(Api::HTTPError)
  end

  it "is the provider the media registry uses" do
    StorageRegistry.reset!
    stub_request(:get, url).to_return(status: 404, body: %({ "errors": [] }))

    expect {
      StorageRegistry.instance.for(target_id)
    }.to raise_error(StorageRegistry::TargetUnavailable, /#{target_id}/)
  ensure
    StorageRegistry.reset!
  end
end
