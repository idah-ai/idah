# frozen_string_literal: true

require "spec_helper"

# DB-backed request specs for POST /accounts/invite that do NOT mock the
# service: they exercise the real Account::Service (and its DB writes) through
# the HTTP layer, proving the expo passes `params` (a hash) to `service.invite`
# and that the invite flow works end-to-end for real actors.
RSpec.describe AccountsExpo, type: :exposition, database: true do
  before do
    allow(Time).to receive(:now).and_return(Time.utc(2025, 1, 1, 0, 0, 0))
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
  end
end