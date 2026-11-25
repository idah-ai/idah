# frozen_string_literal: true

require_relative "../lib/semantic_version"
require_relative "../lib/role_repository"
require_relative "../lib/role_hierarchy"

RSpec.describe RoleHierarchy do
  before do
    RoleRepository.load
  end
  describe ".rank" do
    it "ranks account roles in ascending order" do
      expect(RoleHierarchy.rank("user")).to be < RoleHierarchy.rank("org_owner")
      expect(RoleHierarchy.rank("org_owner")).to be < RoleHierarchy.rank("admin")
      expect(RoleHierarchy.rank("admin")).to be < RoleHierarchy.rank("system")
    end

    it "ranks project roles in ascending order" do
      expect(RoleHierarchy.rank("annotator")).to be < RoleHierarchy.rank("reviewer")
      expect(RoleHierarchy.rank("reviewer")).to be < RoleHierarchy.rank("project_owner")
    end

    it "places all project roles below org_owner" do
      expect(RoleHierarchy.rank("project_owner")).to be < RoleHierarchy.rank("org_owner")
    end

    it "raises for an unknown role" do
      expect { RoleHierarchy.rank("superuser") }.to raise_error(ArgumentError)
    end
  end

  describe ".project_roles" do
    it "returns the ordered project role enum" do
      expect(RoleHierarchy.project_roles).to eq(%w[annotator reviewer project_owner])
    end
  end

  describe ".can_assign_account_role?" do
    it "allows assigning a strictly lower role" do
      expect(RoleHierarchy.can_assign_account_role?("admin", "org_owner")).to be true
      expect(RoleHierarchy.can_assign_account_role?("org_owner", "user")).to be true
      expect(RoleHierarchy.can_assign_account_role?("admin", "user")).to be true
    end

    it "allows admin → admin" do
      expect(RoleHierarchy.can_assign_account_role?("admin", "admin")).to be true
    end

    it "allows org_owner → org_owner" do
      expect(RoleHierarchy.can_assign_account_role?("org_owner", "org_owner")).to be true
    end

    it "rejects assigning an equal or higher role" do
      expect(RoleHierarchy.can_assign_account_role?("user", "user")).to be false
      expect(RoleHierarchy.can_assign_account_role?("user", "org_owner")).to be false
      expect(RoleHierarchy.can_assign_account_role?("org_owner", "admin")).to be false
      expect(RoleHierarchy.can_assign_account_role?("admin", "system")).to be false
    end

    it "rejects a user assigning any role" do
      expect(RoleHierarchy.can_assign_account_role?("user", "org_owner")).to be false
      expect(RoleHierarchy.can_assign_account_role?("user", "admin")).to be false
    end
  end

  describe ".can_assign_project_role?" do
    let(:annotator_rank) { RoleHierarchy.rank("annotator") }
    let(:reviewer_rank) { RoleHierarchy.rank("reviewer") }
    let(:project_owner_rank) { RoleHierarchy.rank("project_owner") }
    let(:org_owner_rank) { RoleHierarchy.rank("org_owner") }

    it "requires effective rank >= project_owner to assign annotator/reviewer" do
      expect(RoleHierarchy.can_assign_project_role?(annotator_rank, "annotator")).to be false
      expect(RoleHierarchy.can_assign_project_role?(reviewer_rank, "annotator")).to be false
      expect(RoleHierarchy.can_assign_project_role?(project_owner_rank, "annotator")).to be true
      expect(RoleHierarchy.can_assign_project_role?(project_owner_rank, "reviewer")).to be true
    end

    it "requires effective rank >= org_owner to assign project_owner" do
      expect(RoleHierarchy.can_assign_project_role?(project_owner_rank, "project_owner")).to be false
      expect(RoleHierarchy.can_assign_project_role?(org_owner_rank, "project_owner")).to be true
    end

    it "rejects assigning a role equal to or above the actor's rank" do
      expect(RoleHierarchy.can_assign_project_role?(reviewer_rank, "reviewer")).to be false
      expect(RoleHierarchy.can_assign_project_role?(annotator_rank, "reviewer")).to be false
    end
  end

  describe ".can_manage_project_member?" do
    let(:project_owner_rank) { RoleHierarchy.rank("project_owner") }
    let(:org_owner_rank) { RoleHierarchy.rank("org_owner") }

    it "allows a project_owner to manage rows up to and including project_owner" do
      expect(RoleHierarchy.can_manage_project_member?(project_owner_rank, "annotator")).to be true
      expect(RoleHierarchy.can_manage_project_member?(project_owner_rank, "reviewer")).to be true
      expect(RoleHierarchy.can_manage_project_member?(project_owner_rank, "project_owner")).to be true
    end

    it "allows an org_owner to manage everything" do
      expect(RoleHierarchy.can_manage_project_member?(org_owner_rank, "project_owner")).to be true
    end

    it "rejects a reviewer managing any member" do
      expect(RoleHierarchy.can_manage_project_member?(RoleHierarchy.rank("reviewer"), "annotator")).to be false
    end
  end

  describe ".merge_role_scope" do
    it "returns the current scope when no request is provided" do
      expect(
        RoleHierarchy.merge_role_scope(
          actor_role: "admin", actor_scope: [], current: { "org" => ["1"] }, requested: nil
        )
      ).to eq("org" => ["1"])
    end

    it "merges additions within the actor's reach" do
      expect(
        RoleHierarchy.merge_role_scope(
          actor_role: "org_owner", actor_scope: ["1", "2"],
          current: { "org" => ["1"] }, requested: { "org" => ["1", "2"] }
        )
      ).to eq("org" => %w[1 2])
    end

    it "honors removals within the actor's reach" do
      expect(
        RoleHierarchy.merge_role_scope(
          actor_role: "org_owner", actor_scope: ["1", "2"],
          current: { "org" => ["1", "2"] }, requested: { "org" => ["2"] }
        )
      ).to eq("org" => ["2"])
    end

    it "preserves orgs outside the actor's reach" do
      expect(
        RoleHierarchy.merge_role_scope(
          actor_role: "org_owner", actor_scope: ["1"],
          current: { "org" => ["1", "999"] }, requested: { "org" => ["1"] }
        )
      ).to eq("org" => %w[1 999])
    end

    it "deduplicates and sorts org ids" do
      expect(
        RoleHierarchy.merge_role_scope(
          actor_role: "admin", actor_scope: [],
          current: { "org" => ["2", "1"] }, requested: { "org" => ["1", "3"] }
        )
      ).to eq("org" => %w[1 3])
    end

    it "raises when an org_owner requests an org outside its reach" do
      expect {
        RoleHierarchy.merge_role_scope(
          actor_role: "org_owner", actor_scope: ["1"],
          current: { "org" => ["1"] }, requested: { "org" => ["999"] }
        )
      }.to raise_error(Verse::Error::Unauthorized)
    end

    it "allows an org_owner to remove an org already in the target's current scope" do
      # owner of A removes A from a co-owner with [A, B] by sending {org: [B]}
      expect(
        RoleHierarchy.merge_role_scope(
          actor_role: "org_owner", actor_scope: ["1"],
          current: { "org" => ["1", "2"] }, requested: { "org" => ["2"] }
        )
      ).to eq("org" => ["2"])
    end

    it "raises when an org_owner adds an org outside its reach even if it is in the current scope" do
      expect {
        RoleHierarchy.merge_role_scope(
          actor_role: "org_owner", actor_scope: ["1"],
          current: { "org" => ["1"] }, requested: { "org" => ["1", "999"] }
        )
      }.to raise_error(Verse::Error::Unauthorized)
    end

    it "allows an admin to request any org and remove any org" do
      expect(
        RoleHierarchy.merge_role_scope(
          actor_role: "admin", actor_scope: [],
          current: { "org" => ["1", "2"] }, requested: { "org" => ["999"] }
        )
      ).to eq("org" => ["999"])
    end

    it "handles a JSON-string current scope" do
      expect(
        RoleHierarchy.merge_role_scope(
          actor_role: "admin", actor_scope: [],
          current: '{"org":["1"]}', requested: { "org" => ["2"] }
        )
      ).to eq("org" => ["2"])
    end

    it "handles symbol-keyed requested scopes" do
      expect(
        RoleHierarchy.merge_role_scope(
          actor_role: "admin", actor_scope: [],
          current: nil, requested: { org: ["1"] }
        )
      ).to eq("org" => ["1"])
    end
  end
end