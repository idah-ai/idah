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
      role: test_role,
      enabled: true
    ).to_i
  end

  let(:ip) { "127.0.0.1" }
  let(:user_agent) { "Mozilla/5.0" }

  # before do
  #   # Ensure Settings are loaded
  #   allow(Settings).to receive(:[]).with("refresh_token.lifetime").and_return(86_400)
  #   allow(Settings).to receive(:[]).with("auth_token.lifetime").and_return(3600)
  # end

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
        }.to raise_error(Verse::Error::Authorization, "Invalid credentials")
      end
    end

    context "with invalid password" do
      it "raises authorization error" do
        expect {
          subject.login(test_email, "wrong_password", ip:, user_agent:)
        }.to raise_error(Verse::Error::Authorization, "Invalid credentials")
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

  describe "#delete_session" do
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

    it "deletes the session" do
      expect(account_session_repo.index({}).size).to eq(1)
      subject.delete_session(refresh_token)
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
    end
  end
end
