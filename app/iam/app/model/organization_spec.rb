# frozen_string_literal: true

require "spec_helper"

RSpec.describe Organization::Repository, database: true do
  let(:auth_context) { Verse::Auth::Context.new }

  def build_user_context(account_id)
    Verse::Auth::Context.new(
      ["iam:organizations.read.as_user"],
      role: "user",
      custom_scopes: {},
      metadata: { id: account_id, email: "user@test.com", name: "User", role: :user }
    )
  end

  context "as a user (as_user scope)" do
    subject { described_class.new(build_user_context(42)) }
    let(:system_repo) { Organization::Repository.new(Verse::Auth::Context[:system]) }

    before do
      # The as_user scope resolves the orgs of the account's membership projects
      # via the dataset service, through ProjectMembership::Lookup.
      @lookup = double(ProjectMembership::Lookup)
      allow(ProjectMembership::Lookup).to receive(:new).and_return(@lookup)
    end

    it "returns the organizations of the account's membership projects" do
      org1 = system_repo.create(name: "Org 1")
      org2 = system_repo.create(name: "Org 2")
      org3 = system_repo.create(name: "Org 3")

      allow(@lookup).to receive(:memberships_for).with(42).and_return(
        [
          double(project_id: "p1", role: "reviewer", organization_id: org1.to_i),
          double(project_id: "p2", role: "annotator", organization_id: org2.to_i)
        ]
      )

      result = subject.index({})

      expect(result.map(&:id)).to contain_exactly(org1.to_i, org2.to_i)
      expect(result.map(&:id)).not_to include(org3.to_i)
    end
  end

  context "as an org_owner (as_org_owner scope)" do
    let(:system_repo) { Organization::Repository.new(Verse::Auth::Context[:system]) }
    let(:org1) { system_repo.create(name: "Org 1") }
    let(:org2) { system_repo.create(name: "Org 2") }
    subject { described_class.new(build_org_owner_context(org1.to_i)) }

    def build_org_owner_context(org_id)
      Verse::Auth::Context.new(
        ["iam:organizations.read.as_org_owner"],
        role: "org_owner",
        custom_scopes: { org: [org_id.to_s] },
        metadata: { id: 7, email: "owner@test.com", name: "Owner", role: :org_owner }
      )
    end

    before do
      @lookup = double(ProjectMembership::Lookup)
      allow(ProjectMembership::Lookup).to receive(:new).and_return(@lookup)
    end

    it "returns the actor's orgs plus the orgs of their membership projects" do
      allow(@lookup).to receive(:memberships_for).with(7).and_return(
        [double(project_id: "p9", role: "reviewer", organization_id: org2.to_i)]
      )

      result = subject.index({})

      expect(result.map(&:id)).to contain_exactly(org1.to_i, org2.to_i)
    end
  end
end