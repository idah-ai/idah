# frozen_string_literal: true

require "spec_helper"

RSpec.describe Auth::Service, database: true do
  let(:auth_context) { Verse::Auth::Context.new }
  let(:system_auth_context) { Verse::Auth::Context.system }

  subject { described_class.new(auth_context) }

  let(:account_repo) { Account::Repository.new(auth_context) }
  let(:account_session_repo) { AccountSession::Repository.new(auth_context) }

  let(:test_email) { "test@example.com" }
  let(:test_password) { "password123" }
  let(:test_name) { "Test User" }
  let(:test_role) { "anonymous" }

  let!(:account_id) do
    hashed_password = BCrypt::Password.create(test_password)
    account_repo.create(
      name: test_name,
      email: test_email,
      hashed_password:,
      role_name: test_role,
      enabled: true
    ).to_i
  end

  let(:ip) { "127.0.0.1" }
  let(:user_agent) { "Mozilla/5.0" }

  describe "#login" do
    context "with valid credentials" do
      it "returns an AccountAuth record with tokens" do
        result = subject.login(test_email, test_password, ip:, user_agent:)

        expect(result).to be_a(AccountAuth::Record)
        expect(result.id).to eq(account_id)
        expect(result.email).to eq(test_email)
        expect(result.name).to eq(test_name)
        expect(result.role_name).to eq(test_role)
        expect(result.auth_token).to be_truthy
        expect(result.refresh_token).to be_truthy
      end

      it "creates an account session" do
        expect {
          subject.login(test_email, test_password, ip:, user_agent:)
        }.to change { account_session_repo.index({}).size }.by(1)
      end
    end

    context "with invalid email" do
      it "raises authorization error" do
        expect {
          subject.login("invalid@example.com", test_password, ip:, user_agent:)
        }.to raise_error(Verse::Error::Authorization, "invalid_credentials")
      end
    end

    context "with invalid password" do
      it "raises authorization error" do
        expect {
          subject.login(test_email, "wrong_password", ip:, user_agent:)
        }.to raise_error(Verse::Error::Authorization, "invalid_credentials")
      end
    end

    context "with account disabled" do
      before do
        account_repo.update(account_id, { enabled: false })
      end

      it "raises authorization error" do
        expect {
          subject.login(test_email, test_password, ip:, user_agent:)
        }.to raise_error(Verse::Error::Authorization, "account_disabled")
      end
    end
  end

  describe "#refresh_token" do
    let(:auth_token) { "some_auth_token" }
    let(:refresh_token) { "some_refresh_token" }
    let(:session_id) { 1 }
    let(:nonce) { 1 }

    before do
      allow(RefreshToken).to receive(:validate).with(refresh_token).and_return([account_id, session_id, nonce])
    end

    context "with valid refresh token" do
      it "returns new tokens" do
        result = subject.refresh_token(auth_token, refresh_token, ip:, user_agent:)

        expect(result).to be_a(AccountAuth::Record)
        expect(result.id).to eq(account_id)
        expect(result.auth_token).to be_a(String)
        expect(result.auth_token).to be_truthy
        expect(result.refresh_token).to be_a(String)
        expect(result.refresh_token).to be_truthy
      end
    end

    context "with invalid account" do
      before do
        allow(RefreshToken).to receive(:validate).with(refresh_token).and_return([999, session_id, nonce])
      end

      it "raises BadRefreshTokenError" do
        expect {
          subject.refresh_token(auth_token, refresh_token, ip:, user_agent:)
        }.to raise_error(BadRefreshTokenError, "Account not found")
      end
    end
  end

  describe "#logout" do
    let(:refresh_token) { "some_refresh_token" }
    let(:session_id) {
      account_session_repo.create(
        account_id:,
        refresh_seq: Time.now.to_i,
        nonce:,
        ip:,
        user_agent:
      ).to_i
    }
    let(:nonce) { 1 }

    before do
      allow(RefreshToken).to receive(:validate).with(refresh_token).and_return([account_id, session_id, nonce])
    end

    it "logout, deleting the session" do
      expect(account_session_repo.index({}).size).to eq(1)
      subject.logout(refresh_token)
      expect(account_session_repo.index({}).size).to eq(0)
    end
  end

  describe "#create_refresh_token" do
    let(:account) do
      Account::Record.new(
        {
          id: account_id,
          email: test_email,
          name: test_name,
          role: test_role
        }
      )
    end

    it "creates a refresh token" do
      allow(account_session_repo).to receive(:bump_refresh_seq).and_return([Time.now.to_i, 1])

      token = subject.create_refresh_token(account, nonce: 1, ip:, user_agent:)

      expect(token).to be_a(String)
    end
  end

  context "As Admin", as: :admin do
    subject { described_class.new(current_auth_context) }

    describe "#login_api" do
      let(:api_keys_repo) { ApiKey::Repository.new(current_auth_context) }
      let(:system_api_keys_repo) { ApiKey::Repository.new(Verse::Auth::Context[:system]) }
      let(:raw_key) { "IDAH_#{SecureRandom.hex(32)}" }
      let(:key_sha) { Digest::SHA256.hexdigest(raw_key) }

      let!(:service_account_id) do
        account_repo.create(
          name: "API Service Account",
          email: "api_service@example.com",
          role_name: "api_service",
          enabled: true
        )
      end

      let!(:api_key_id) do
        api_keys_repo.create(
          account_id: service_account_id,
          name: "Test API Key",
          key_sha:,
          key_label: "#{raw_key[0..9]}...#{raw_key[-4..]}",
          permissions: %w[org:read org:write],
          scope_type: "org",
          scope_value: ["org-123"],
          status: "active",
          expires_at: Time.now + 30 * 24 * 60 * 60
        )
      end

      context "with valid API key" do
        it "returns an AccountAuth record with auth token" do
          result = subject.login_api(raw_key)

          expect(result).to be_a(AccountAuth::Record)
          expect(result.id).to eq(service_account_id.to_i)
          expect(result.email).to eq("api_service@example.com")
          expect(result.auth_token).to be_truthy
          expect(result.refresh_token).to be_nil
          expect(result.role_name).to eq("api:org:read,org:write")
        end

        it "updates the last_used_at timestamp" do
          subject.login_api(raw_key)

          updated_key = system_api_keys_repo.find!(api_key_id)
          expect(updated_key.last_used_at).not_to be_nil
        end

        it "accepts custom token_expiration" do
          result = subject.login_api(raw_key, token_expiration: 7200)

          expect(result.exp).to be > Time.now.to_i
          expect(result.exp).to be <= Time.now.to_i + 7200
        end
      end

      context "with invalid key format" do
        it "raises authorization error for invalid prefix" do
          expect {
            subject.login_api("INVALID_#{SecureRandom.hex(32)}")
          }.to raise_error(Verse::Error::Authorization, "Invalid Key")
        end

        it "raises authorization error for invalid length" do
          expect {
            subject.login_api("IDAH_short")
          }.to raise_error(Verse::Error::Authorization, "Invalid Key")
        end
      end

      context "with non-existent key" do
        it "raises authorization error" do
          fake_key = "IDAH_#{SecureRandom.hex(32)}"

          expect {
            subject.login_api(fake_key)
          }.to raise_error(Verse::Error::Authorization, "Invalid credentials")
        end
      end

      context "with revoked API key" do
        before do
          system_api_keys_repo.update!(api_key_id, { revoked_at: Time.now, status: "revoked" })
        end

        it "raises authorization error" do
          expect {
            subject.login_api(raw_key)
          }.to raise_error(Verse::Error::Authorization, /revoked or expired/)
        end
      end

      context "with expired API key" do
        before do
          system_api_keys_repo.update!(api_key_id, { expires_at: Time.now - 3600 })
        end

        it "raises authorization error" do
          expect {
            subject.login_api(raw_key)
          }.to raise_error(Verse::Error::Authorization, /revoked or expired/)
        end
      end

      context "with inactive API key" do
        before do
          system_api_keys_repo.update!(api_key_id, { status: "inactive" })
        end

        it "raises authorization error" do
          expect {
            subject.login_api(raw_key)
          }.to raise_error(Verse::Error::Authorization, /not active/)
        end
      end

      context "with different scope types" do
        it "handles 'all' scope type" do
          system_api_keys_repo.update!(api_key_id, { scope_type: "all", scope_value: [] })

          result = subject.login_api(raw_key)

          expect(result).to be_a(AccountAuth::Record)
          expect(result.role_scope).to eq({})
        end

        it "handles 'project' scope type" do
          system_api_keys_repo.update!(api_key_id, { scope_type: "project", scope_value: ["proj-1", "proj-2"] })

          result = subject.login_api(raw_key)

          expect(result).to be_a(AccountAuth::Record)
          expect(result.role_scope).to eq({ project: ["proj-1", "proj-2"] })
        end
      end
    end
  end
end
