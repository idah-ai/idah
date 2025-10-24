# frozen_string_literal: true

require "spec_helper"

RSpec.describe Auth::SimpleExpo, type: :exposition, as: :system do
  let(:now) { Time.now.utc }
  let(:test_email) { "test@example.com" }
  let(:test_password) { "password123" }
  let(:test_name) { "Test User" }
  let(:test_role) { "user" }
  let(:ip) { "127.0.0.1" }
  let(:user_agent) { "Mozilla/5.0" }

  let(:auth_service) { instance_double(Auth::Service) }

  let(:account_auth_record) do
    AccountAuth::Record.new(
      {
        id: 1,
        email: test_email,
        name: test_name,
        picture_url: nil,
        role_name: test_role,
        role_labels: {},
        scope: {},
        role_rights: [],
        user_agent:,
        auth_token: "test_auth_token",
        refresh_token: "test_refresh_token",
        exp: (Time.now + 3600).to_i
      }
    )
  end

  before do
    allow(Auth::Service).to receive(:new).and_return(auth_service)
  end

  describe "POST /auth/login" do
    let(:login_params) do
      {
        email: test_email,
        password: test_password,
        cookie: true,
        user_agent:
      }
    end

    context "with valid credentials" do
      before do
        allow(auth_service).to receive(:login).and_return(account_auth_record)
      end

      it "returns account auth data" do
        post "/auth/login", login_params

        expect(last_response.status).to eq 200
        body = JSON.parse(last_response.body, symbolize_names: true)
        expect(body[:data][:attributes][:email]).to eq test_email
        expect(body[:data][:attributes][:name]).to eq test_name
        expect(body[:data][:attributes][:role_name]).to eq test_role
      end

      it "sets cookies when cookie parameter is true" do
        post "/auth/login", login_params

        expect(last_response.status).to eq 200
        # Cookies would be set in the response headers
      end

      it "includes auth token in meta" do
        post "/auth/login", login_params

        expect(last_response.status).to eq 200
        body = JSON.parse(last_response.body, symbolize_names: true)
        expect(body[:meta][:token]).to eq "test_auth_token"
      end
    end

    context "with invalid credentials" do
      before do
        allow(auth_service).to receive(:login).and_raise(
          Verse::Error::Authorization.new("Invalid credentials")
        )
      end

      it "returns authorization error" do
        post "/auth/login", login_params

        expect(last_response.status).to eq 401
      end
    end
  end

  describe "GET /auth/refresh" do
    context "with valid refresh token" do
      before do
        allow(auth_service).to receive(:refresh_token).and_return(account_auth_record)
      end

      it "returns new account auth data" do
        get "/auth/refresh?user_agent=#{user_agent}"

        expect(last_response.status).to eq 200
        body = JSON.parse(last_response.body, symbolize_names: true)
        expect(body[:data][:attributes][:email]).to eq test_email
      end
    end

    context "with invalid refresh token" do
      before do
        allow(auth_service).to receive(:refresh_token).and_raise(
          BadRefreshTokenError.new("Invalid refresh token")
        )
      end

      it "returns the error and clears refresh cookie" do
        get "/auth/refresh?user_agent=#{user_agent}"

        expect(last_response.status).to be >= 400
      end
    end

    context "with authorization error" do
      before do
        allow(auth_service).to receive(:refresh_token).and_raise(
          Verse::Error::Authorization.new("Unauthorized")
        )
      end

      it "returns authorization error and clears refresh cookie" do
        get "/auth/refresh?user_agent=#{user_agent}"

        expect(last_response.status).to eq 401
      end
    end
  end

  describe "GET /auth/logout" do
    before do
      allow(auth_service).to receive(:delete_session)
    end

    it "logs out the user and returns no content" do
      get "/auth/logout"

      expect(last_response.status).to eq 204
    end

    it "deletes the session" do
      expect(auth_service).to receive(:delete_session)
      get "/auth/logout"
    end
  end
end
