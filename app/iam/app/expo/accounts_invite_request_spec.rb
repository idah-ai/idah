# frozen_string_literal: true

require "spec_helper"

# DB-backed request specs for POST /accounts/invite that do NOT mock the
# service: they exercise the real Account::Service (and its DB writes) through
# the HTTP layer, proving the expo passes `params` (a hash) to `service.invite`
# and that the invite flow works end-to-end for real actors.
RSpec.describe AccountsExpo, type: :exposition, database: true do
  before do
    allow(Time).to receive(:now).and_return(Time.utc(2025, 1, 1, 0, 0, 0))

    # The org_owner read scope resolves co-members through the dataset service;
    # the inter-service client needs a bearer token. Override the auth provider
    # with a fixed token so the real client code runs without a service-account
    # login round-trip. Save the existing provider so it can be restored after,
    # so this override does not leak into later specs in the same run.
    @original_bearer_auth = Api[:idah].instance_variable_get(:@auths)[:bearer]
    Api[:idah].add_auth(:bearer) do |request|
      request["Authorization"] = "Bearer test-token"
    end
  end

  after do
    if @original_bearer_auth
      Api[:idah].add_auth(:bearer, &@original_bearer_auth)
    else
      Api[:idah].instance_variable_get(:@auths).delete(:bearer)
    end
  end

  # Stubs the dataset project_members HTTP calls that the org_owner read scope
  # makes through ProjectMembership::Lookup, so an existing account can be
  # resolved as readable or not.
  def stub_org_owner_read_scope(account_ids: [])
    stub_request(:get, %r{dataset/project_members}).
      with { |req| CGI.unescape(req.uri.query.to_s).include?("filter[organization_id__in]") }.
      to_return(
        status: 200,
        body: JSON.generate(
          data: account_ids.map do |id|
            { type: "dataset:project_members", id: "pm#{id}", attributes: { account_id: id } }
          end
        ),
        headers: { "Content-Type" => "application/json" }
      )
    stub_request(:get, %r{dataset/project_members}).
      with { |req| CGI.unescape(req.uri.query.to_s).include?("filter[account_id]") }.
      to_return(status: 200, body: JSON.generate(data: []), headers: { "Content-Type" => "application/json" })
  end

  context "as admin", as: :admin do
    it "invites a new org_owner scoped to the requested org" do
      post "/accounts/invite", { email: "owner@test.com", role_name: "org_owner", role_scope: { org: ["1"] } }

      expect(last_response.status).to eq 200

      body = JSON.parse(last_response.body, symbolize_names: true)
      record = deserialize(body)

      expect(record.role_name).to eq "org_owner"
      expect(record.role_scope).to eq(org: ["1"])
    end

    it "invites a plain user" do
      post "/accounts/invite", { email: "invitee@test.com", role_name: "user" }

      expect(last_response.status).to eq 200

      body = JSON.parse(last_response.body, symbolize_names: true)
      record = deserialize(body)

      expect(record.email).to eq "invitee@test.com"
      expect(record.role_name).to eq "user"
      expect(record.enabled).to eq true
    end

    it "returns 422 when the email is missing" do
      post "/accounts/invite", { role_name: "user" }

      expect(last_response.status).to eq 422
    end
  end

  context "as org_owner", as: :org_owner do
    it "invites a new org_owner scoped to its own org" do
      post "/accounts/invite", { email: "owner@test.com", role_name: "org_owner", role_scope: { org: ["1"] } }

      expect(last_response.status).to eq 200

      body = JSON.parse(last_response.body, symbolize_names: true)
      record = deserialize(body)

      expect(record.role_name).to eq "org_owner"
      expect(record.role_scope).to eq(org: ["1"])
    end

    it "rejects an invite with an org outside its reach" do
      post "/accounts/invite", { email: "owner@test.com", role_name: "org_owner", role_scope: { org: ["999"] } }

      expect(last_response.status).to eq 403
    end

    it "treats an outranked existing account as a no-op with a restricted response" do
      stub_org_owner_read_scope
      create_account(email: "admin@test.com", role_name: "admin", enabled: true)

      post "/accounts/invite", { email: "admin@test.com", role_name: "user" }

      expect(last_response.status).to eq 200
      body = JSON.parse(last_response.body, symbolize_names: true)
      record = deserialize(body)
      # Restricted to id/name/email: no role is disclosed.
      expect(record.email).to eq "admin@test.com"
      expect(record.role_name).to be_nil
    end

    it "rejects a disabled account with a generic message when unreadable" do
      stub_org_owner_read_scope
      create_account(email: "disabled@test.com", enabled: false)

      post "/accounts/invite", { email: "disabled@test.com", role_name: "user" }

      expect(last_response.status).to eq 403
      expect(last_response.body).to include "contact an administrator"
    end

    it "rejects a disabled account with a specific message when readable" do
      stub_org_owner_read_scope(account_ids: [50])
      create_account(id: 50, email: "disabled@test.com", enabled: false)

      post "/accounts/invite", { email: "disabled@test.com", role_name: "user" }

      expect(last_response.status).to eq 403
      expect(last_response.body).to include "re-enable"
    end
  end

  def create_account(attrs)
    attrs = attrs.dup
    attrs[:role_scope] = attrs[:role_scope].to_json if attrs.key?(:role_scope)
    Account::Repository.new(Verse::Auth::Context[:system]).create(attrs)
  end
end
