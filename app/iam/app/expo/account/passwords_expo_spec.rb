# frozen_string_literal: true

require "spec_helper"

RSpec.describe Account::PasswordsExpo, type: :exposition, as: :system do
  let(:service) { instance_double(AccountPassword::Service) }

  before do
    allow(AccountPassword::Service).to receive(:new).and_return(service)
  end

  describe "POST /account/passwords/request_reset" do
    it "requests a password reset" do
      expect(service).to receive(:request_password_reset).with("test@example.com")

      post "/account/passwords/request_reset",
           {
             email: "test@example.com"
           }

      expect(last_response.status).to eq 204
    end

    it "returns validation error when email is missing" do
      post "/account/passwords/request_reset", {}

      expect(last_response.status).to eq 422
      expect(JSON.parse(last_response.body, symbolize_names: true)[:errors]).to eq(
        [
          {
            status: 422,
            title: "Verse::Error::ValidationFailed",
            detail: "is required",
            source: { pointer: "/email" }
          }
        ]
      )
    end

    it "returns validation error when email is empty" do
      post "/account/passwords/request_reset",
           {
             email: ""
           }

      expect(last_response.status).to eq 422
      expect(JSON.parse(last_response.body, symbolize_names: true)[:errors]).to eq(
        [
          {
            status: 422,
            title: "Verse::Error::ValidationFailed",
            detail: "must be filled",
            source: { pointer: "/email" }
          }
        ]
      )
    end
  end

  describe "POST /account/passwords/reset" do
    let(:valid_password) { "SecureP@ss123" }
    let(:reset_token) { "valid_token_123" }

    it "resets password with valid token and password" do
      expect(service).to receive(:reset_password).with(reset_token, valid_password)

      post "/account/passwords/reset",
           {
             token: reset_token,
             password: valid_password
           }

      expect(last_response.status).to eq 204
    end

    it "returns validation error when token is missing" do
      post "/account/passwords/reset",
           {
             password: valid_password
           }

      expect(last_response.status).to eq 422
      expect(JSON.parse(last_response.body, symbolize_names: true)[:errors]).to eq(
        [
          {
            status: 422,
            title: "Verse::Error::ValidationFailed",
            detail: "is required",
            source: { pointer: "/token" }
          }
        ]
      )
    end

    it "returns validation error when password is missing" do
      post "/account/passwords/reset",
           {
             token: reset_token
           }

      expect(last_response.status).to eq 422
      expect(JSON.parse(last_response.body, symbolize_names: true)[:errors]).to eq(
        [
          {
            status: 422,
            title: "Verse::Error::ValidationFailed",
            detail: "is required",
            source: { pointer: "/password" }
          }
        ]
      )
    end

    it "returns validation error when password is too short" do
      post "/account/passwords/reset",
           {
             token: reset_token,
             password: "Short1!"
           }

      expect(last_response.status).to eq 422
      expect(JSON.parse(last_response.body, symbolize_names: true)[:errors]).to eq(
        [
          {
            status: 422,
            title: "Verse::Error::ValidationFailed",
            detail: "must be at least 8 characters",
            source: { pointer: "/password" }
          }
        ]
      )
    end

    it "returns validation error when password lacks uppercase letter" do
      post "/account/passwords/reset",
           {
             token: reset_token,
             password: "password123!"
           }

      expect(last_response.status).to eq 422
      expect(JSON.parse(last_response.body, symbolize_names: true)[:errors]).to eq(
        [
          {
            status: 422,
            title: "Verse::Error::ValidationFailed",
            detail: "must include at least one uppercase letter",
            source: { pointer: "/password" }
          }
        ]
      )
    end

    it "returns validation error when password lacks lowercase letter" do
      post "/account/passwords/reset",
           {
             token: reset_token,
             password: "PASSWORD123!"
           }

      expect(last_response.status).to eq 422
      expect(JSON.parse(last_response.body, symbolize_names: true)[:errors]).to eq(
        [
          {
            status: 422,
            title: "Verse::Error::ValidationFailed",
            detail: "must include at least one lowercase letter",
            source: { pointer: "/password" }
          }
        ]
      )
    end

    it "returns validation error when password lacks digit" do
      post "/account/passwords/reset",
           {
             token: reset_token,
             password: "Password!@#"
           }

      expect(last_response.status).to eq 422
      expect(JSON.parse(last_response.body, symbolize_names: true)[:errors]).to eq(
        [
          {
            status: 422,
            title: "Verse::Error::ValidationFailed",
            detail: "must include at least one digit",
            source: { pointer: "/password" }
          }
        ]
      )
    end

    it "returns validation error when password lacks special character" do
      post "/account/passwords/reset",
           {
             token: reset_token,
             password: "Password123"
           }

      expect(last_response.status).to eq 422
      expect(JSON.parse(last_response.body, symbolize_names: true)[:errors]).to eq(
        [
          {
            status: 422,
            title: "Verse::Error::ValidationFailed",
            detail: "must include at least one special character",
            source: { pointer: "/password" }
          }
        ]
      )
    end
  end

  describe "GET /account/passwords/token_valid" do
    it "returns true when token is valid" do
      expect(service).to receive(:token_valid?).with("valid_token").and_return(true)

      get "/account/passwords/token_valid?token=valid_token"

      expect(last_response.status).to eq 200
      expect(JSON.parse(last_response.body, symbolize_names: true)).to eq({ data: { valid: true } })
    end

    it "returns false when token is invalid" do
      expect(service).to receive(:token_valid?).with("invalid_token").and_return(false)

      get "/account/passwords/token_valid?token=invalid_token"

      expect(last_response.status).to eq 200
      expect(JSON.parse(last_response.body, symbolize_names: true)).to eq({ data: { valid: false } })
    end

    it "returns validation error when token is missing" do
      get "/account/passwords/token_valid"

      expect(last_response.status).to eq 422
      expect(JSON.parse(last_response.body, symbolize_names: true)[:errors]).to eq(
        [
          {
            status: 422,
            title: "Verse::Error::ValidationFailed",
            detail: "is required",
            source: { pointer: "/token" }
          }
        ]
      )
    end
  end

  describe "POST /account/passwords/change" do
    it "changes password for authenticated user" do
      current_auth_context.metadata[:id] = 42

      expect(service).to receive(:change_password).with(42, "oldPass1!", "NewP@ssw0rd!")

      post "/account/passwords/change",
           {
             current_password: "oldPass1!",
             new_password: "NewP@ssw0rd!"
           }
      expect(last_response.status).to eq 204
    end
  end
end
