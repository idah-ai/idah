# frozen_string_literal: true

require "spec_helper"

RSpec.describe ScopedQuery::Service, database: true do
  let(:system_context) { Verse::Auth::Context[:system] }
  let(:project_repo) { Project::Repository.new(system_context) }
  let(:member_repo) { ProjectMember::Repository.new(system_context) }

  let(:project_id) do
    project_repo.create(name: "Test Project", created_by_email: "system@example.com", organization_id: 1)
  end

  let(:account_id) { 42 }

  before do
    member_repo.create(
      project_id: project_id,
      account_id: account_id,
      role: "project_owner",
      name: "Owner",
      email: "owner@example.com",
      invited_by_id: 1
    )
  end

  it "returns true when the account has an enabled membership with the role" do
    expect(described_class.with_project_access?(account_id, project_id, ["project_owner"])).to be true
  end

  it "returns false when the membership is disabled" do
    member_repo.update!(member_repo.index({ account_id: account_id }).first.id, { disabled_at: Time.now })

    expect(described_class.with_project_access?(account_id, project_id, ["project_owner"])).to be false
  end

  it "returns false when the account has no membership with the role" do
    expect(described_class.with_project_access?(account_id, project_id, ["reviewer"])).to be false
  end
end
