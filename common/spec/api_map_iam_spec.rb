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
# (e.g. sending the request body or query incorrectly) fails here.
RSpec.describe "IAM API client map" do
  include WebMock::API

  before do
    # Save the shared client's global state and restore it after each example so
    # these specs do not leak a base_url/auth override into other specs.
    @saved_base_url = Api[:idah].base_url
    @saved_bearer = Api[:idah].auths[:bearer]

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
    Api[:idah].base_url = @saved_base_url
    if @saved_bearer
      Api[:idah].add_auth(:bearer, &@saved_bearer)
    else
      Api[:idah].auths.delete(:bearer)
    end
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
                id: 100,
                name: "New Member",
                email: "new@test.com"
              }
            }
          ),
          headers: { "Content-Type" => "application/json" }
        )

      Api[:idah].iam.accounts.resend_invitation(id: 100)
    end
  end
end