# frozen_string_literal: true

require "spec_helper"

RSpec.describe AccountSession::Service, database: true do
  let(:auth_context) { Verse::Auth::Context.new }

  subject { described_class.new(auth_context) }

  let(:account_repo) { Account::Repository.new(auth_context) }
  let(:account_session_repo) { AccountSession::Repository.new(auth_context) }

  let(:test_email) { "test@example.com" }
  let(:test_password) { "password123" }
  let(:test_role) { "user" }

  let!(:account_id) do
    hashed_password = BCrypt::Password.create(test_password)
    account_repo.create(
      name: "Test User",
      email: test_email,
      hashed_password:,
      role_name: test_role,
      enabled: true
    ).to_i
  end

  let!(:session_id) do
    account_session_repo.create(
      account_id:,
      refresh_seq: Time.now.to_i,
      nonce: 1,
      ip: "127.0.0.1",
      user_agent: "Mozilla/5.0"
    ).to_i
  end

  describe "#index" do
    it "returns a list of account sessions" do
      result = subject.index({})

      # expect(result).to be_an(Array)
      expect(result.size).to eq(1)
      expect(result.first.id).to eq(session_id)
      expect(result.first.account_id).to eq(account_id)
    end

    it "supports filtering" do
      result = subject.index({ account_id: })

      expect(result.size).to eq(1)
      expect(result.first.account_id).to eq(account_id)
    end
  end

  describe "#delete" do
    it "deletes an account session" do
      expect {
        subject.delete(session_id)
      }.to change { account_session_repo.index({}).size }.by(-1)
    end

    it "returns true when session is deleted" do
      result = subject.delete(session_id)

      expect(result).to be_truthy
    end
  end
end
