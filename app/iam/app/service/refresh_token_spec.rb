# frozen_string_literal: true

require "spec_helper"

RSpec.describe RefreshToken, database: true do
  let(:account_id) { 42 }
  let(:session_id) { 123 }
  let(:nonce) { 1 }
  let(:seq_id) { Time.now.to_i }
  let(:exp_time) { Time.now.to_i + 3600 }

  describe ".validate" do
    let(:valid_token) do
      described_class.encode(account_id, session_id, nonce, seq_id, exp: exp_time)
    end

    let(:account_session_repo) { instance_double(AccountSession::Repository) }

    before do
      described_class.instance_variable_set(:@account_sessions, nil)
      allow(AccountSession::Repository).to receive(:new).and_return(account_session_repo)
    end

    context "with a valid token and valid sequence" do
      before do
        allow(account_session_repo).to receive(:check_seq).with(
          account_id, session_id, nonce, seq_id
        ).and_return(true)
      end

      it "returns account_id, session_id, and nonce" do
        uid, sid, nc = described_class.validate(valid_token)

        expect(uid).to eq(account_id)
        expect(sid).to eq(session_id)
        expect(nc).to eq(nonce)
      end
    end

    context "with a valid token but invalid sequence" do
      before do
        allow(account_session_repo).to receive(:check_seq).and_return(false)
        allow(account_session_repo).to receive(:delete)
      end

      it "raises BadRefreshTokenError" do
        expect {
          described_class.validate(valid_token)
        }.to raise_error(BadRefreshTokenError, "Bad uid/refid")
      end
    end

    context "with an invalid JWT token" do
      it "raises BadRefreshTokenError for malformed token" do
        expect {
          described_class.validate("invalid.token.here")
        }.to raise_error(BadRefreshTokenError, "Invalid JWT token")
      end

      it "raises BadRefreshTokenError for expired token" do
        expired_token = described_class.encode(
          account_id, session_id, nonce, seq_id, exp: Time.now.to_i - 3600
        )

        expect {
          described_class.validate(expired_token)
        }.to raise_error(BadRefreshTokenError, "Invalid JWT token")
      end

      it "raises BadRefreshTokenError for token with wrong signature" do
        wrong_token = JWT.encode(
          { uid: account_id, nc: nonce, refid: seq_id, sub: "ort", exp: exp_time, sid: session_id },
          "wrong_secret_key",
          "HS256"
        )

        expect {
          described_class.validate(wrong_token)
        }.to raise_error(BadRefreshTokenError, "Invalid JWT token")
      end

      it "raises BadRefreshTokenError for token with wrong subject" do
        wrong_sub_token = JWT.encode(
          { uid: account_id, nc: nonce, refid: seq_id, sub: "wrong", exp: exp_time, sid: session_id },
          Verse::Http::Auth::Token.sign_key,
          Verse::Http::Auth::Token.sign_algorithm
        )

        expect {
          described_class.validate(wrong_sub_token)
        }.to raise_error(BadRefreshTokenError, "Invalid JWT token")
      end
    end

    context "with an empty or nil token" do
      it "raises BadRefreshTokenError for nil token" do
        expect {
          described_class.validate(nil)
        }.to raise_error(BadRefreshTokenError, "Invalid JWT token")
      end

      it "raises BadRefreshTokenError for empty string" do
        expect {
          described_class.validate("")
        }.to raise_error(BadRefreshTokenError, "Invalid JWT token")
      end
    end
  end
end
