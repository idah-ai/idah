# frozen_string_literal: true

require "rspec"
require "webmock/rspec"
require "json"
require_relative "../lib/api"
require_relative "../lib/api/service"
require_relative "../lib/api/exposition"

# These specs exercise the REAL client code registered in
# `common/lib/api/__map__/iam.rb` (no stubbing of `Api[:idah].iam.accounts.*`).
# They stub only the HTTP boundary with WebMock, so a regression in the client
# (e.g. passing `body:` instead of `params:`) fails here.
RSpec.describe "IAM API client map" do
  include WebMock::API

  before do
    WebMock.enable!
    Api[:idah].base_url = "https://idah.example.com"

    # The real auth block (`generate_token`) needs Verse::Config credentials,
    # which the common spec does not load. Override the auth provider with a fixed
    # token so the specs exercise the REAL invite/resend client code (the HTTP
    # boundary is stubbed; `Api[:idah].iam.accounts.*` is not).
    Api[:idah].add_auth(:bearer) do |request|
      request["Authorization"] = "Bearer test-token"
    end
  end

  after do
    WebMock.disable!
    WebMock.reset!
  end

  describe "Api[:idah].iam.accounts.invite" do
    it "POSTs the attributes as the JSON body with a bearer token" do
      stub_request(:post, "https://idah.example.com/iam/accounts/invite").
        with(
          body: {
            "email" => "new@test.com",
            "name" => "New Member",
            "role_name" => "user",
            "role_scope" => {}
          },
          headers: {
            "Authorization" => "Bearer test-token",
            "Content-Type" => "application/json"
          }
        ).
        to_return(
          status: 200,
          body: JSON.generate(
            data: {
              type: "iam:accounts",
              id: "100",
              attributes: {
                email: "new@test.com",
                name: "New Member",
                role_name: "user",
                role_scope: {},
                enabled: true,
                joined_at: nil
              }
            }
          ),
          headers: { "Content-Type" => "application/json" }
        )

      account = Api[:idah].iam.accounts.invite(
        attributes: {
          email: "new@test.com",
          name: "New Member",
          role_name: "user",
          role_scope: {}
        }
      )

      expect(account.id).to eq("100")
      expect(account.email).to eq("new@test.com")
      expect(account.role_name).to eq("user")
    end
  end

  describe "Api[:idah].iam.accounts.resend_invitation" do
    it "POSTs to the resend path with the id as a path param and a bearer token" do
      stub_request(:post, "https://idah.example.com/iam/accounts/100/resend_invitation").
        with(
          headers: {
            "Authorization" => "Bearer test-token"
          }
        ).
        to_return(
          status: 200,
          body: JSON.generate(
            data: {
              type: "iam:accounts",
              id: "100",
              attributes: {
                email: "new@test.com",
                role_name: "user",
                enabled: true
              }
            }
          ),
          headers: { "Content-Type" => "application/json" }
        )

      Api[:idah].iam.accounts.resend_invitation(id: 100)
    end
  end
end