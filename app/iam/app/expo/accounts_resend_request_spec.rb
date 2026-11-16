# frozen_string_literal: true

require "spec_helper"

# DB-backed request specs for POST /accounts/:id/resend_invitation that do NOT
# mock the service: they exercise the real Account::Service (and its DB writes)
# through the HTTP layer. The org_owner read scope resolves co-members through
# the dataset service, so only those cross-service HTTP calls are stubbed.
RSpec.describe AccountsExpo, type: :exposition, database: true do
  let(:system_repo) { Account::Repository.new(Verse::Auth::Context[:system]) }

  before do
    allow(Time).to receive(:now).and_return(Time.utc(2025, 1, 1, 0, 0, 0))

    # The org_owner read scope resolves co-members through the dataset service;
    # the inter-service client needs a bearer token. Override the auth provider
    # with a fixed token so the specs exercise the real client code without a
    # service-account login round-trip.
    Api[:idah].add_auth(:bearer) do |request|
      request["Authorization"] = "Bearer test-token"
    end
  end

  def create_pending_account(email: "pending@test.com")
    system_repo.create(
      name: "Pending User",
      email: email,
      role_name: "user",
      enabled: true,
      invitation_token: "old-token",
      invitation_expired_at: Time.now - 1
    )
  end

  context "as admin", as: :admin do
    it "resends without leaking the invitation or password-reset token" do
      id = create_pending_account

      post "/accounts/#{id}/resend_invitation"

      expect(last_response.status).to eq 200
      expect(last_response.body).not_to include("invitation_token")
      expect(last_response.body).not_to include("password_reset_token")

      record = deserialize(JSON.parse(last_response.body, symbolize_names: true))
      expect(record.id.to_s).to eq(id.to_s)
      expect(record.email).to eq("pending@test.com")
    end
  end

  context "as org_owner", as: :org_owner do
    it "resends without leaking the invitation or password-reset token" do
      id = create_pending_account

      # The org_owner read scope resolves the account through the dataset
      # service: member_account_ids(organization_ids: ["1"]) returns the pending
      # account, and memberships_for(2) returns none.
      stub_request(:get, %r{dataset/project_members}).
        with { |req| CGI.unescape(req.uri.query.to_s).include?("filter[organization_id__in]") }.
        to_return(
          status: 200,
          body: JSON.generate(
            data: [
              { type: "dataset:project_members", id: "pm1", attributes: { account_id: id } }
            ]
          ),
          headers: { "Content-Type" => "application/json" }
        )
      stub_request(:get, %r{dataset/project_members}).
        with { |req| CGI.unescape(req.uri.query.to_s).include?("filter[account_id]") }.
        to_return(
          status: 200,
          body: JSON.generate(data: []),
          headers: { "Content-Type" => "application/json" }
        )

      post "/accounts/#{id}/resend_invitation"

      expect(last_response.status).to eq 200
      expect(last_response.body).not_to include("invitation_token")
      expect(last_response.body).not_to include("password_reset_token")

      record = deserialize(JSON.parse(last_response.body, symbolize_names: true))
      expect(record.id.to_s).to eq(id.to_s)
      expect(record.email).to eq("pending@test.com")
    end
  end
end
