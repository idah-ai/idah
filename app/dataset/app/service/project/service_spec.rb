# frozen_string_literal: true

require "spec_helper"

RSpec.describe Project::Service, database: true do
  let(:system_context) { Verse::Auth::Context[:system] }
  let(:project_repo) { Project::Repository.new(system_context) }

  let!(:project_org1_id) do
    project_repo.create(name: "Project Org 1", created_by_email: "system@example.com", organization_id: 1)
  end

  # Builds an update payload carrying an organization_id, as a direct caller
  # (bypassing the exposition layer, which drops the readonly field) would.
  def update_record_with_org(id, org)
    deserialize(
      {
        data: {
          type: Resource::Dataset::Projects,
          id: id,
          attributes: {
            name: "Updated Project",
            description: "A test project",
            organization_id: org
          }
        }
      }
    )
  end

  context "as org_owner owning both current and target org", as: :org_owner do
    subject { described_class.new(current_auth_context) }

    before do
      allow(current_auth_context).to receive(:custom_scopes).and_return({ org: %w[1 2] })
    end

    it "can move a project to another owned org" do
      record = subject.update(update_record_with_org(project_org1_id, 2))

      expect(record.organization_id).to eq(2)
    end
  end

  context "as org_owner owning only the current org", as: :org_owner do
    subject { described_class.new(current_auth_context) }

    # org_owner scopes are { org: ["1"] } by default.

    it "cannot move a project to an org they do not own" do
      expect {
        subject.update(update_record_with_org(project_org1_id, 2))
      }.to raise_error(Verse::Error::Unauthorized)
    end
  end

  context "as project_owner", as: :project_owner do
    subject { described_class.new(current_auth_context) }

    before do
      ProjectMember::Repository.new(system_context).create(
        project_id: project_org1_id,
        account_id: 3,
        role: "project_owner",
        name: "Project Owner User",
        email: "project_owner@example.com",
        invited_by_id: 1
      )
    end

    it "cannot move a project to another org" do
      expect {
        subject.update(update_record_with_org(project_org1_id, 2))
      }.to raise_error(Verse::Error::Unauthorized)
    end
  end

  context "as admin", as: :admin do
    subject { described_class.new(current_auth_context) }

    it "can move a project to another org" do
      record = subject.update(update_record_with_org(project_org1_id, 2))

      expect(record.organization_id).to eq(2)
    end
  end
end
