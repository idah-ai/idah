# frozen_string_literal: true

require "spec_helper"

RSpec.describe ApiKeysExpo, type: :exposition, as: :system do
  let(:now) { Time.now.utc }

  let(:api_key_record) do
    ApiKey::Record.new(
      {
        id: "test-key-id",
        account_id: 123,
        name: "Test API Key",
        key_label: "IDAH_1234...abcd",
        key_sha: Digest::SHA256.hexdigest("test_key"),
        permissions: %w[org_rw_all org_ro_own],
        scope_type: "org",
        scope_value: ["org-123"],
        expires_at: now + 30 * 24 * 60 * 60,
        revoked_at: nil,
        status: "active",
        last_used_at: nil,
        created_at: now,
        updated_at: now
      }
    )
  end

  let(:api_key_data) do
    {
      data: {
        type: Resource::Iam::ApiKeys,
        id: "test-key-id",
        attributes: {
          name: "Test API Key",
          permissions: %w[org_rw_all org_ro_own],
          scope_type: "org",
          scope_value: ["org-123"],
          expires_at: (now + 30 * 24 * 60 * 60).iso8601
        }
      }
    }
  end

  let(:service) { instance_double(ApiKey::Service) }

  before do
    allow(ApiKey::Service).to receive(:new).and_return(service)
  end

  it "list API keys" do
    expect(service).to receive(:index).and_return([api_key_record])
    get "/api_keys"

    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    records = deserialize(body)

    expect(records[0].id).to eq "test-key-id"
    expect(records[0].name).to eq "Test API Key"
    expect(records[0].permissions).to eq %w[org_rw_all org_ro_own]
  end

  it "show an API key" do
    expect(service).to receive(:show).with("test-key-id", included: []).and_return(api_key_record)
    get "/api_keys/test-key-id"

    expect(last_response.status).to eq 200
    body = JSON.parse(last_response.body, symbolize_names: true)
    record = deserialize(body)

    expect(record.id).to eq "test-key-id"
    expect(record.name).to eq "Test API Key"
    expect(record.status).to eq "active"
  end

  it "create an API key" do
    created_key = api_key_record.dup

    expect(service).to receive(:create).and_return(created_key)
    post "/api_keys", api_key_data

    expect(last_response.status).to eq 201
    body = JSON.parse(last_response.body, symbolize_names: true)
    created_record = deserialize(body)

    expect(created_record.id).to eq "test-key-id"
    expect(created_record.name).to eq "Test API Key"
  end

  it "update an API key" do
    expect(service).to receive(:update) do |args|
      expect(args.id).to eq "test-key-id"
      expect(args.attributes[:name]).to eq "Test API Key"
      api_key_record
    end

    patch "/api_keys/test-key-id", api_key_data
    expect(last_response.status).to eq 200
  end

  it "delete an API key" do
    expect(service).to receive(:delete).with("test-key-id").and_return(true)
    delete "/api_keys/test-key-id"

    expect(last_response.status).to eq 204
  end

  it "get available permissions" do
    permissions = [
      ApiPermission::Record.new({
        name: "org_ro_own",
        title: "API - Organization Read-Only (Own)",
        description: "Can read data for own organization"
      }),
      ApiPermission::Record.new({
        name: "org_rw_all",
        title: "API - Organization Read/Write",
        description: "Can read and write data for all organizations"
      })
    ]

    expect(service).to receive(:show_permissions).and_return(permissions)
    get "/api_keys/permissions"

    expect(last_response.status).to eq 200
  end

  it "revoke an API key" do
    revoked_key = ApiKey::Record.new(api_key_record.to_h.merge(status: "revoked", revoked_at: Time.now))

    expect(service).to receive(:revoke).with("test-key-id").and_return(revoked_key)
    post "/api_keys/test-key-id/revoke"

    expect(last_response.status).to eq 200
  end

  describe "scheduled task" do
    it "responds to expire_api_keys method" do
      expect(described_class.instance_methods).to include(:expire_api_keys)
    end
  end
end
