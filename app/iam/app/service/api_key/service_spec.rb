# frozen_string_literal: true

require "spec_helper"

RSpec.describe ApiKey::Service, database: true do
  let(:auth_context) { Verse::Auth::Context.new }

  subject { described_class.new(auth_context) }

  let(:api_keys_repo) { ApiKey::Repository.new(auth_context) }
  let(:accounts_repo) { Account::Repository.new(auth_context) }

  before do
    # freeze the time
    allow(Time).to receive(:now).and_return(
      Time.utc(2025, 1, 1, 0, 0, 0)
    )
  end

  context "As Admin", as: :admin do
    subject { described_class.new(current_auth_context) }

    let!(:service_account_id) do
      accounts_repo.create(
        name: "API Service Account",
        email: "api_service@example.com",
        role_name: "api_service",
        enabled: true
      )
    end

    describe "#index" do
      it "returns a list of API keys" do
        api_keys_repo.create(
          account_id: service_account_id,
          name: "Test Key 1",
          key_label: "IDAH_1234...abcd",
          key_sha: Digest::SHA256.hexdigest("test_key_1"),
          permissions: %w[org_rw_all],
          scope_type: "org",
          scope_value: ["org-123"],
          expires_at: Time.now + 30 * 24 * 60 * 60,
          revoked_at: nil,
          status: "active"
        )

        result = subject.index({})

        expect(result.size).to eq(1)
        expect(result[0].name).to eq("Test Key 1")
      end
    end

    describe "#create" do
      let(:attributes) do
        {
          name: "Test API Key",
          permissions: %w[org_rw_all org_ro_own],
          scope_type: "org",
          scope_value: ["org-123"],
          expires_at: Time.now + 30 * 24 * 60 * 60
        }
      end

      it "creates a new API key" do
        record = deserialize(
          {
            data: {
              type: Resource::Iam::ApiKeys,
              attributes:,
            }
          }
        )

        created_api_key = subject.create(record)

        expect(created_api_key.name).to eq("Test API Key")
        expect(created_api_key.permissions).to be_a(Array)
        expect(created_api_key.scope_type).to eq("org")
        expect(created_api_key.scope_value).to eq(["org-123"])
        expect(created_api_key.status).to eq("active")
        expect(created_api_key.key).to start_with("IDAH_")
        expect(created_api_key.key.length).to eq(69)
        expect(created_api_key.key_label).to match(/^IDAH_\w+\.\.\.\w{4}$/)
      end

      it "validates scope_type" do
        record = deserialize(
          {
            data: {
              type: Resource::Iam::ApiKeys,
              attributes: attributes.merge(scope_type: "invalid"),
            }
          }
        )

        expect { subject.create(record) }.to raise_error(
          Verse::Error::ValidationFailed,
          /Invalid scope_type/
        )
      end

      it "validates scope_value for non-all scope types" do
        record = deserialize(
          {
            data: {
              type: Resource::Iam::ApiKeys,
              attributes: attributes.merge(scope_type: "org", scope_value: []),
            }
          }
        )

        expect { subject.create(record) }.to raise_error(
          Verse::Error::ValidationFailed,
          /scope_value cannot be empty/
        )
      end

      it "raises error if no permissions are allowed" do
        record = deserialize(
          {
            data: {
              type: Resource::Iam::ApiKeys,
              attributes: attributes.merge(permissions: []),
            }
          }
        )

        expect { subject.create(record) }.to raise_error(
          Verse::Error::CannotCreateRecord,
          "Invalid API Key permission."
        )
      end
    end

    describe "#show" do
      let!(:api_key_id) do
        record = deserialize(
          {
            data: {
              type: Resource::Iam::ApiKeys,
              attributes: {
                name: "Show Test Key",
                permissions: %w[org_ro_own],
                scope_type: "all",
                scope_value: []
              }
            }
          }
        )

        created = subject.create(record)
        created.id
      end

      it "shows an API key" do
        found_api_key = subject.show(api_key_id)
        expect(found_api_key.id).to eq(api_key_id)
        expect(found_api_key.name).to eq("Show Test Key")
      end
    end

    describe "#update" do
      let!(:api_key_id) do
        record = deserialize(
          {
            data: {
              type: Resource::Iam::ApiKeys,
              attributes: {
                name: "Original Name",
                permissions: %w[org_ro_own],
                scope_type: "all",
                scope_value: [],
                expires_at: Time.now + 30 * 24 * 60 * 60
              }
            }
          }
        )

        created = subject.create(record)
        created.id
      end

      it "updates an API key" do
        record = deserialize(
          {
            data: {
              type: Resource::Iam::ApiKeys,
              id: api_key_id,
              attributes: {
                name: "Updated Name",
                expires_at: Time.now + 60 * 24 * 60 * 60
              }
            }
          }
        )

        updated_api_key = subject.update(record)
        expect(updated_api_key.name).to eq("Updated Name")
      end

      it "raises error if key is revoked" do
        # First revoke the key
        subject.revoke(api_key_id)

        record = deserialize(
          {
            data: {
              type: Resource::Iam::ApiKeys,
              id: api_key_id,
              attributes: {
                name: "Should Fail"
              }
            }
          }
        )

        expect { subject.update(record) }.to raise_error(
          Verse::Error::ValidationFailed,
          "Cannot update a revoked API key"
        )
      end

      it "raises error if expires_at is in the past" do
        record = deserialize(
          {
            data: {
              type: Resource::Iam::ApiKeys,
              id: api_key_id,
              attributes: {
                expires_at: Time.now - 3600
              }
            }
          }
        )

        expect { subject.update(record) }.to raise_error(
          Verse::Error::ValidationFailed,
          "expires_at must be in the future"
        )
      end
    end

    describe "#delete" do
      let!(:api_key_id) do
        record = deserialize(
          {
            data: {
              type: Resource::Iam::ApiKeys,
              attributes: {
                name: "To Delete",
                permissions: %w[org:read],
                scope_type: "all",
                scope_value: []
              }
            }
          }
        )

        created = subject.create(record)
        created.id
      end

      it "deletes an API key" do
        subject.delete(api_key_id)

        expect { api_keys_repo.find!(api_key_id) }.to raise_error(Verse::Error::NotFound)
      end
    end

    describe "#revoke" do
      let!(:api_key_id) do
        record = deserialize(
          {
            data: {
              type: Resource::Iam::ApiKeys,
              attributes: {
                name: "To Revoke",
                permissions: %w[org_ro_own],
                scope_type: "all",
                scope_value: []
              }
            }
          }
        )

        created = subject.create(record)
        created.id
      end

      it "revokes an API key by setting revoked_at and status" do
        revoked_key = subject.revoke(api_key_id)

        expect(revoked_key.status).to eq("revoked")
        expect(revoked_key.revoked_at).to eq(Time.now)
      end
    end

    describe "#show_permissions" do
      it "returns available permissions" do
        permissions = subject.show_permissions

        expect(permissions).to be_an(Array)
        permissions.each do |permission|
          expect(permission).to be_a(ApiPermission::Record)
          expect(permission.name).to be_a(String)
          expect(permission.title).to be_a(String)
        end
      end
    end

    describe "#expire_api_keys" do
      before do
        # Create an expired key
        record = deserialize(
          {
            data: {
              type: Resource::Iam::ApiKeys,
              attributes: {
                name: "Expired Key",
                permissions: %w[org_ro_own],
                scope_type: "all",
                scope_value: [],
                expires_at: Time.now - 3600
              }
            }
          }
        )

        @expired_key = subject.create(record)

        # Manually set status back to active to simulate an expired but not updated key
        api_keys_repo.update!(@expired_key.id, { status: "active" })
      end

      it "updates status of expired keys to 'expired'" do
        subject.expire_api_keys

        updated_key = api_keys_repo.find!(@expired_key.id)
        expect(updated_key.status).to eq("expired")
      end
    end
  end
end
