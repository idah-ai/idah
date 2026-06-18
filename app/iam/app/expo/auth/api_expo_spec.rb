# frozen_string_literal: true

require "spec_helper"

RSpec.describe Auth::ApiExpo, type: :exposition, as: :system do
  let(:now) { Time.now.utc }
  let(:raw_key) { "IDAH_#{SecureRandom.hex(32)}" }

  let(:account_auth_record) do
    AccountAuth::Record.new(
      {
        id: 123,
        email: "api_service@example.com",
        name: "API Service Account",
        picture_url: nil,
        role_name: "api:org:read,org:write",
        role_scope: { "org" => ["1"] },
        role_rights: %w[read write],
        auth_token: "jwt_token_here",
        refresh_token: nil,
        exp: now.to_i + 3600
      }
    )
  end

  let(:service) { instance_double(Auth::Service) }

  before do
    allow(Auth::Service).to receive(:new).and_return(service)
  end

  describe "POST /auth/api/login" do
    let(:login_data) do
      {
        api_key: raw_key,
        token_expiration: 3600
      }
    end

    context "with valid API key" do
      it "authenticates and returns account auth with token in meta" do
        expect(service).to receive(:login_api).with(
          raw_key,
          token_expiration: 3600
        ).and_return(account_auth_record)

        post "/auth/api/login", login_data

        expect(last_response.status).to eq 200
        body = JSON.parse(last_response.body, symbolize_names: true)

        expect(body[:meta][:token]).to eq("jwt_token_here")
        expect(body[:data][:id]).to eq("123")
        expect(body[:data][:attributes][:email]).to eq("api_service@example.com")
      end
    end

    context "with default token expiration" do
      it "uses default expiration of 3600 seconds" do
        expect(service).to receive(:login_api).with(
          raw_key,
          token_expiration: 3600
        ).and_return(account_auth_record)

        post "/auth/api/login", { api_key: raw_key }

        expect(last_response.status).to eq 200
      end
    end

    context "with custom token expiration" do
      it "uses the custom expiration time" do
        expect(service).to receive(:login_api).with(
          raw_key,
          token_expiration: 7200
        ).and_return(account_auth_record)

        post "/auth/api/login", { api_key: raw_key, token_expiration: 7200 }

        expect(last_response.status).to eq 200
      end
    end

    context "with invalid API key" do
      it "returns authorization error" do
        expect(service).to receive(:login_api).and_raise(
          Verse::Error::Authorization.new("Invalid credentials")
        )

        post "/auth/api/login", { api_key: "invalid_key" }

        expect(last_response.status).to eq 401
      end
    end

    context "with revoked API key" do
      it "returns authorization error" do
        expect(service).to receive(:login_api).and_raise(
          Verse::Error::Authorization.new("API key has been revoked or expired")
        )

        post "/auth/api/login", { api_key: raw_key }

        expect(last_response.status).to eq 401
      end
    end

    context "without API key parameter" do
      it "returns error" do
        post "/auth/api/login", {}

        expect(last_response.status).to be >= 400
      end
    end
  end
end
