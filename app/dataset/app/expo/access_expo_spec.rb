# frozen_string_literal: true

require "spec_helper"

RSpec.describe AccessExpo, type: :exposition, database: true do
  let(:project_id) do
    Project::Repository.new(Verse::Auth::Context[:system])
                       .create(name: "P1", created_by_email: "s@example.com", organization_id: 1)
  end

  let(:command) do
    {
      jsonrpc: "2.0",
      method: "check",
      params: {
        rule: "allowed",
        action: "read",
        resource: "dataset:projects",
        id: project_id,
        principals: [
          { account_id: 1, role_name: "admin", role_scope: {} },
          { account_id: 20, role_name: "user", role_scope: {} }
        ]
      },
      id: 1
    }
  end

  def rpc_call
    post "/access/_rpc", command, { "CONTENT_TYPE" => "application/json" }
    JSON.parse(last_response.body, symbolize_names: true)
  end

  it "returns the allowed account ids to the system" do
    body = as_user(:system) { rpc_call }

    expect(body[:result]).to eq(allowed: [1])
  end

  it "refuses other callers" do
    body = as_user(:admin) { rpc_call }

    expect(body[:result]).to be_nil
    expect(body[:error]).not_to be_nil
  end
end
