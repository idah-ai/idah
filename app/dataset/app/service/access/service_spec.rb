# frozen_string_literal: true

require "spec_helper"

RSpec.describe Access::Service, database: true do
  subject(:service) { described_class.new(Verse::Auth::Context[:system]) }

  let(:system_context) { Verse::Auth::Context[:system] }
  let(:projects) { Project::Repository.new(system_context) }
  let(:members) { ProjectMember::Repository.new(system_context) }
  let(:datasets) { Dataset::Repository.new(system_context) }
  let(:entries) { Entry::Repository.new(system_context) }

  let!(:project_id) { projects.create(name: "P1", created_by_email: "s@example.com", organization_id: 1) }
  let!(:dataset_id) do
    datasets.create(
      name: "D1", project_id:, modality: "video", workflow_configuration: {}, labeling_configuration: {}
    )
  end
  let!(:entry_id) do
    entries.create(
      project_id:,
      dataset_id:,
      priority: 1,
      resource: "http://example.com/e.mp4",
      wf_step: "annotate",
      status: "in_progress",
      assigned_to_id: 11
    )
  end

  let!(:member_ids) do
    { 10 => "project_owner", 11 => "annotator", 13 => "reviewer" }.to_h do |account_id, role|
      [account_id,
       members.create(project_id:, account_id:, role:, email: "#{account_id}@example.com", invited_by_id: 1)]
    end
  end
  let!(:removed_member_id) do
    id = members.create(project_id:, account_id: 14, role: "annotator", email: "14@example.com", invited_by_id: 1)
    members.update!(id, { disabled_at: Time.now })
    id
  end

  def principal(account_id, role_name = "user", role_scope = {})
    { account_id:, role_name:, role_scope: }
  end

  let(:admin) { principal(1, "admin") }
  let(:org_owner) { principal(2, "org_owner", { "org" => ["1"] }) }
  let(:other_org_owner) { principal(3, "org_owner", { "org" => ["2"] }) }
  let(:project_owner) { principal(10) }
  let(:assigned_annotator) { principal(11) }
  let(:reviewer) { principal(13) }
  let(:removed_member) { principal(14) }
  let(:outsider) { principal(20) }
  let(:missing_id) { "00000000-0000-0000-0000-000000000000" }

  let(:everyone) do
    [admin, org_owner, other_org_owner, project_owner, assigned_annotator, reviewer, removed_member, outsider]
  end

  def allowed(**params)
    service.check(rule: "allowed", principals: everyone, **params)
  end

  it "answers read from the repository's read scope" do
    expect(allowed(action: "read", resource: "dataset:projects", id: project_id))
      .to contain_exactly(1, 2, 10, 11, 13)
    expect(allowed(action: "read", resource: "dataset:datasets", id: dataset_id))
      .to contain_exactly(1, 2, 10, 11)
    expect(allowed(action: "read", resource: "dataset:entries", id: entry_id))
      .to contain_exactly(1, 2, 10, 11)
  end

  it "answers update from the repository's update scope" do
    expect(allowed(action: "update", resource: "dataset:projects", id: project_id))
      .to contain_exactly(1, 2, 10)
  end

  it "answers update on a membership row, for a removed member's row too" do
    expect(allowed(action: "update", resource: "dataset:project_members", id: member_ids[13].to_s))
      .to contain_exactly(1, 2, 10)
    expect(allowed(action: "update", resource: "dataset:project_members", id: removed_member_id.to_s))
      .to contain_exactly(1, 2, 10)
  end

  it "also allows the member an event is about, when they can read their own row" do
    expect(
      allowed(
        action: "update",
        resource: "dataset:project_members",
        id: member_ids[13].to_s,
        own_account_id: 13
      )
    )
      .to contain_exactly(1, 2, 10, 13)
  end

  it "doesn't allow a removed member, even as the member an event is about" do
    expect(
      allowed(
        action: "update",
        resource: "dataset:project_members",
        id: removed_member_id.to_s,
        own_account_id: 14
      )
    )
      .to contain_exactly(1, 2, 10)
  end

  it "allows nobody for a missing row" do
    expect(allowed(action: "read", resource: "dataset:projects", id: missing_id)).to be_empty
  end

  it "refuses unknown rules and resources" do
    expect {
      service.check(rule: "project_role", principals: [], action: "read", resource: "dataset:projects", id: "1")
    }
      .to raise_error(Verse::Error::ValidationFailed)
    expect { allowed(action: "read", resource: "dataset:annotations", id: "1") }
      .to raise_error(Verse::Error::ValidationFailed)
  end

  it "is reserved to the system" do
    admin_service = described_class.new(Verse::Auth::Context.from_role("admin", metadata: { id: 1 }))

    expect {
      admin_service.check(
        rule: "allowed",
        principals: [admin],
        action: "read",
        resource: "dataset:projects",
        id: project_id
      )
    }
      .to raise_error(Verse::Error::Unauthorized)
  end
end
