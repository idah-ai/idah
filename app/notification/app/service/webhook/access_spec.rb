# frozen_string_literal: true

require "spec_helper"

RSpec.describe Webhook::Access, database: true do
  subject(:access) { described_class.new(Verse::Auth::Context[:system]) }

  let(:webhooks) { Webhook::Repository.new(Verse::Auth::Context[:system]) }

  # Accounts as IAM returns them.
  let(:accounts) do
    [
      { id: "1", role_name: "admin", role_scope: {}, enabled: true },
      { id: "2", role_name: "org_owner", role_scope: { org: ["1"] }, enabled: true },
      { id: "3", role_name: "user", role_scope: {}, enabled: true },
      { id: "4", role_name: "user", role_scope: {}, enabled: true },
      { id: "5", role_name: "org_owner", role_scope: { org: ["2"] }, enabled: true }
    ]
  end

  let(:allowed_by_dataset) { [3] }

  def create_webhook(account_id, role_name)
    id = webhooks.create(
      {
        account_id:, role_name:, name: "Hook", url: "https://93.184.216.34/hook",
        secret: "whsec_#{"a" * 64}", events: ["dataset.project.updated"], enabled: true
      }
    )
    webhooks.find!(id)
  end

  let!(:admin_hook) { create_webhook(1, "admin") }
  let!(:org_owner_hook) { create_webhook(2, "org_owner") }
  let!(:user_hook) { create_webhook(3, "user") }
  let!(:other_user_hook) { create_webhook(4, "user") }
  let!(:other_org_owner_hook) { create_webhook(5, "org_owner") }
  let(:all_hooks) { [admin_hook, org_owner_hook, user_hook, other_user_hook, other_org_owner_hook] }

  before do
    Api[:idah].base_url = "http://idah.test"

    stub_request(:post, "http://idah.test/iam/auth/login")
      .to_return(
        status: 200,
        body: JSON.generate(data: {}, meta: { token: "test.eyJleHAiOjQxMDI0NDQ4MDB9.test" }),
        headers: { "Content-Type": "application/json" }
      )

    stub_request(:get, %r{\Ahttp://idah\.test/iam/accounts})
      .to_return do
        {
          status: 200,
          body: JSON.generate(
            data: accounts.map { |a| { type: "iam:accounts", id: a[:id], attributes: a.except(:id) } }
          ),
          headers: { "Content-Type": "application/json" }
        }
      end

    stub_request(:post, "http://idah.test/dataset/access/_rpc")
      .to_return do
        {
          status: 200,
          body: JSON.generate(jsonrpc: "2.0", result: { allowed: allowed_by_dataset }, id: 1),
          headers: { "Content-Type": "application/json" }
        }
      end
  end

  def allowed_ids(rule)
    access.allowed(all_hooks, rule).map(&:account_id)
  end

  describe "owner status" do
    it "keeps every active owner when the event only needs the role" do
      expect(allowed_ids(nil)).to contain_exactly(1, 2, 3, 4, 5)
    end

    it "drops and disables webhooks whose owner is disabled, changed role or no longer exists" do
      accounts[2][:enabled] = false
      accounts[3][:role_name] = "org_owner"
      accounts.delete_at(4)

      expect(allowed_ids(nil)).to contain_exactly(1, 2)
      expect(webhooks.find!(user_hook.id).enabled).to be false
      expect(webhooks.find!(other_user_hook.id).enabled).to be false
      expect(webhooks.find!(other_org_owner_hook.id).enabled).to be false
      expect(webhooks.find!(admin_hook.id).enabled).to be true
    end
  end

  describe "org rule" do
    it "allows admins and owners of the organization, without asking dataset" do
      expect(allowed_ids({ rule: "org", organization_ids: ["1"] })).to contain_exactly(1, 2)
      expect(a_request(:post, %r{dataset/access})).not_to have_been_made
    end
  end

  describe "rules checked by the owning service" do
    let(:rule) { { rule: "allowed", action: "read", service: "dataset", resource: "dataset:projects", id: "p1" } }

    it "asks dataset once for every owner and keeps the allowed ones" do
      expect(allowed_ids(rule)).to eq [3]

      expect(
        a_request(:post, "http://idah.test/dataset/access/_rpc").with { |request|
          params = JSON.parse(request.body, symbolize_names: true)[:params]
          params[:rule] == "allowed" && params[:action] == "read" &&
            params[:resource] == "dataset:projects" && params[:id] == "p1" &&
            params[:principals].map { _1[:account_id] }.sort == [1, 2, 3, 4, 5] &&
            params[:principals].find { _1[:account_id] == 2 }[:role_scope] == { org: ["1"] }
        }
      ).to have_been_made.once
    end

    it "allows nobody when the check fails" do
      stub_request(:post, "http://idah.test/dataset/access/_rpc").to_return(status: 500, body: "boom")

      expect(allowed_ids(rule)).to be_empty
    end
  end
end
