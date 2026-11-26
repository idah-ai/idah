# frozen_string_literal: true

require "spec_helper"

RSpec.describe Access::Service, database: true do
  subject(:service) { described_class.new(Verse::Auth::Context[:system]) }

  let(:system_context) { Verse::Auth::Context[:system] }
  let(:project_id) { "019b4e62-0000-7000-8000-000000000001" }

  let(:export_id) do
    job_id = Jobs::Repository.new(system_context).create(
      job_class: "Exports::Job", arguments: {}, status: "completed", scheduled_at: Time.now
    )
    Exports::Repository.new(system_context).create(job_id:, project_id:, created_by_id: 10)
  end

  def json(data) = { status: 200, body: JSON.generate(data:), headers: { "Content-Type": "application/json" } }

  before do
    Api[:idah].base_url = "http://idah.test"

    stub_request(:post, "http://idah.test/iam/auth/login")
      .to_return(status: 200, body: JSON.generate(data: {}, meta: { token: "test.eyJleHAiOjQxMDI0NDQ4MDB9.test" }))

    # Org 1 holds the project.
    stub_request(:get, %r{\Ahttp://idah\.test/dataset/projects\?}).to_return do |request|
      in_org = request.uri.query.include?("filter%5Borganization_id%5D%5B0%5D=1")
      json(in_org ? [{ type: "dataset:projects", id: project_id, attributes: {} }] : [])
    end

    # Account 10 owns the project.
    allow_any_instance_of(ProjectMembership::Lookup).to receive(:memberships_for) do |_lookup, account_id|
      if account_id == 10
        [ProjectMembership::Lookup::Membership.new(
          project_id:,
          role: "project_owner",
          organization_id: 1
        )]
      else
        []
      end
    end
  end

  def principal(account_id, role_name = "user", role_scope = {})
    { account_id:, role_name:, role_scope: }
  end

  it "allows whoever can read the export" do
    principals = [
      principal(1, "admin"),
      principal(2, "org_owner", { "org" => ["1"] }),
      principal(3, "org_owner", { "org" => ["2"] }),
      principal(10),
      principal(11)
    ]

    expect(service.check(rule: "allowed", action: "read", resource: "sync:exports", id: export_id, principals:))
      .to contain_exactly(1, 2, 10)
  end

  it "rejects unknown rules and resources" do
    expect {
      service.check(
        rule: "project_role",
        principals: [],
        action: "read",
        resource: "sync:exports",
        id: "1"
      )
    }.to raise_error(Verse::Error::ValidationFailed)
    expect { service.check(rule: "allowed", action: "read", resource: "sync:jobs", id: "1", principals: []) }
      .to raise_error(Verse::Error::ValidationFailed)
  end

  it "is reserved to the system" do
    admin_service = described_class.new(Verse::Auth::Context.from_role("admin", metadata: { id: 1 }))

    expect {
      admin_service.check(rule: "allowed", action: "read", resource: "sync:exports", id: export_id, principals: [])
    }
      .to raise_error(Verse::Error::Unauthorized)
  end
end
