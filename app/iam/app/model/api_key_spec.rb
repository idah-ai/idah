# frozen_string_literal: true

require "spec_helper"

RSpec.describe ApiKey, database: true do
  let(:auth_context) { Verse::Auth::Context.new }

  describe ApiKey::Record do
    let(:api_key_attributes) do
      {
        id: "test-key-id",
        account_id: 123,
        created_by_id: 1,
        name: "Test API Key",
        key_label: "IDAH_1234...abcd",
        key_sha: Digest::SHA256.hexdigest("test_key"),
        permissions: %w[org_rw_all],
        scope_type: "org",
        scope_value: ["1"],
        expires_at: Time.now + 30 * 24 * 60 * 60,
        revoked_at: nil,
        status: "active",
        last_used_at: nil,
        created_at: Time.now,
        updated_at: Time.now
      }
    end

    subject { described_class.new(api_key_attributes) }

    describe "#expired?" do
      context "when expires_at is nil" do
        it "returns false" do
          api_key_attributes[:expires_at] = nil
          expect(subject.expired?).to be false
        end
      end

      context "when expires_at is in the future" do
        it "returns false" do
          api_key_attributes[:expires_at] = Time.now + 3600
          expect(subject.expired?).to be false
        end
      end

      context "when expires_at is in the past" do
        it "returns true" do
          api_key_attributes[:expires_at] = Time.now - 3600
          expect(subject.expired?).to be true
        end
      end
    end

    describe "#revoked?" do
      context "when revoked_at is nil" do
        it "returns false" do
          expect(subject.revoked?).to be false
        end
      end

      context "when revoked_at has a timestamp" do
        it "returns true" do
          api_key_attributes[:revoked_at] = Time.now
          api_key = described_class.new(api_key_attributes)
          expect(api_key.revoked?).to be true
        end
      end
    end

    describe "#valid_key?" do
      context "when key is not expired and not revoked" do
        it "returns true" do
          expect(subject.valid_key?).to be true
        end
      end

      context "when key is expired" do
        it "returns false" do
          api_key_attributes[:expires_at] = Time.now - 3600
          api_key = described_class.new(api_key_attributes)
          expect(api_key.valid_key?).to be false
        end
      end

      context "when key is revoked" do
        it "returns false" do
          api_key_attributes[:revoked_at] = Time.now
          api_key = described_class.new(api_key_attributes)
          expect(api_key.valid_key?).to be false
        end
      end
    end

    describe "#build_scope" do
      context "when scope_type is 'all'" do
        it "returns an empty hash" do
          api_key_attributes[:scope_type] = "all"
          api_key = described_class.new(api_key_attributes)
          expect(api_key.build_scope).to eq({})
        end
      end

      context "when scope_type is 'org'" do
        it "returns a hash with org scope" do
          api_key_attributes[:scope_type] = "org"
          api_key_attributes[:scope_value] = [123, 456]
          api_key = described_class.new(api_key_attributes)
          expect(api_key.build_scope).to eq({ org: ["123", "456"] })
        end
      end

      context "when scope_type is 'project'" do
        it "returns a hash with project scope" do
          api_key_attributes[:scope_type] = "project"
          api_key_attributes[:scope_value] = [789, 101]
          api_key = described_class.new(api_key_attributes)
          expect(api_key.build_scope).to eq({ project: ["789", "101"] })
        end
      end
    end
  end

  describe ApiKey::Repository do
    subject { described_class.new(auth_context) }

    it "can be instantiated" do
      expect(subject).to be_a(ApiKey::Repository)
    end
  end
end
