# frozen_string_literal: true

require "spec_helper"

RSpec.describe ProjectAccess::Service, database: true do
  let(:system_context) { Verse::Auth::Context[:system] }
  let(:project_repo) { Project::Repository.new(system_context) }
  let(:member_repo) { ProjectMember::Repository.new(system_context) }

  let(:org_a) { 1 }
  let(:org_b) { 2 }

  let(:project_a) {
    project_repo.create(name: "Project A", created_by_email: "system@example.com", organization_id: org_a)
  }
  let(:project_b) {
    project_repo.create(name: "Project B", created_by_email: "system@example.com", organization_id: org_b)
  }

  def build_context(role, scopes: {}, id: 99, email: "actor@test.com")
    # Build from the role so rights come from common/data/roles/*.yml via the
    # real RoleBackend (set on boot), not a hardcoded list.
    Verse::Auth::Context.from_role(
      role,
      custom_scopes: scopes,
      metadata: { id:, email:, name: "Actor", role: role.to_sym }
    )
  end

  def add_member(project_id, account_id, role, disabled: false)
    member_repo.create(
      project_id: project_id,
      account_id: account_id,
      role: role,
      name: "Member",
      email: "member@test.com",
      invited_by_id: 1,
      disabled_at: (Time.now if disabled)
    )
  end

  def resolve(ctx, project_id)
    described_class.resolve(ctx, project_id, action: :read, resource: Resource::Dataset::Projects)
  end

  def effective_rank(ctx, project_id)
    described_class.effective_rank(ctx, project_id, action: :read, resource: Resource::Dataset::Projects)
  end

  context "as admin" do
    let(:ctx) { build_context("admin") }

    it "resolves :all on any project" do
      expect(resolve(ctx, project_a)).to eq(:all)
      expect(resolve(ctx, project_b)).to eq(:all)
    end
  end

  context "as org_owner" do
    let(:ctx) { build_context("org_owner", scopes: { org: [org_a.to_s] }, id: 2) }

    it "resolves :org_owner on a project in the actor's org" do
      expect(resolve(ctx, project_a)).to eq(:org_owner)
    end

    it "resolves :none on a foreign project with no membership" do
      expect(resolve(ctx, project_b)).to eq(:none)
    end

    it "resolves the membership role on a foreign project where the actor is a member" do
      add_member(project_b, 2, "reviewer")

      expect(resolve(ctx, project_b)).to eq(:reviewer)
    end

    it "resolves :none on a foreign project where the membership is disabled" do
      add_member(project_b, 2, "reviewer", disabled: true)

      expect(resolve(ctx, project_b)).to eq(:none)
    end
  end

  context "as a user" do
    let(:ctx) { build_context("user", id: 3) }

    it "resolves :none on a project with no membership" do
      expect(resolve(ctx, project_a)).to eq(:none)
    end

    it "resolves the membership role on an assigned project" do
      add_member(project_a, 3, "annotator")

      expect(resolve(ctx, project_a)).to eq(:annotator)
    end

    it "resolves :none when the membership is disabled" do
      add_member(project_a, 3, "annotator", disabled: true)

      expect(resolve(ctx, project_a)).to eq(:none)
    end
  end

  context "with an API-key project scope" do
    let(:ctx) { build_context("org_owner", scopes: { org: [org_a.to_s], project: [project_a] }, id: 2) }

    it "resolves :org_owner on a scoped project" do
      expect(resolve(ctx, project_a)).to eq(:org_owner)
    end

    it "resolves :none on a project outside the API-key scope even if in the actor's org" do
      expect(resolve(ctx, project_b)).to eq(:none)
    end
  end

  describe ".effective_rank" do
    it "returns the org_owner rank for an org_owner on their own project" do
      ctx = build_context("org_owner", scopes: { org: [org_a.to_s] }, id: 2)
      expect(effective_rank(ctx, project_a)).to eq(RoleHierarchy.rank("org_owner"))
    end

    it "returns the membership role rank for an org_owner on a foreign project" do
      ctx = build_context("org_owner", scopes: { org: [org_a.to_s] }, id: 2)
      add_member(project_b, 2, "reviewer")

      expect(effective_rank(ctx, project_b)).to eq(RoleHierarchy.rank("reviewer"))
    end

    it "returns nil when the actor has no access" do
      ctx = build_context("user", id: 3)
      expect(effective_rank(ctx, project_a)).to be_nil
    end
  end
end
