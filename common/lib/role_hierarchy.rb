# frozen_string_literal: true

# Role-hierarchy helpers. Masks are the single source of truth: account role
# masks come from `RoleRepository` (loaded at boot from `common/data/roles/*.yml`),
# project role masks from `RoleRepository.project_role_masks`
# (`common/data/project_roles.yml`).
module RoleHierarchy
  module_function

  # The numeric rank of an account or project role. Unknown roles raise.
  def rank(role_name)
    mask = RoleRepository.role_masks[role_name.to_s]
    raise ArgumentError, "Unknown role `#{role_name}`" unless mask

    SemanticVersion[mask]
  end

  # Ordered project roles (the enum), lowest first by mask.
  def project_roles
    RoleRepository.project_role_masks
      .sort_by { |_name, mask| SemanticVersion[mask] }
      .map(&:first)
  end

  # Whether an actor may assign the given account role to a target, per the
  # account-level rules:
  #   - an actor may assign a role ranked strictly below their own, except
  #   - admin → admin, and
  #   - org_owner → org_owner (restricted to the actor's own orgs, enforced by
  #     the caller via merge_role_scope).
  def can_assign_account_role?(actor_role, target_role)
    actor_role = actor_role.to_s
    target_role = target_role.to_s

    return true if actor_role == "admin" && target_role == "admin"
    return true if actor_role == "org_owner" && target_role == "org_owner"

    rank(actor_role) > rank(target_role)
  end

  # Whether an actor with the given effective rank on a project may assign the
  # given project role. Only effective rank >= project_owner can invite/manage;
  # assigning project_owner requires effective rank >= org_owner.
  def can_assign_project_role?(actor_rank, target_role)
    target_rank = rank(target_role)

    if target_role == "project_owner"
      actor_rank >= rank("org_owner")
    else
      actor_rank >= rank("project_owner") && actor_rank > target_rank
    end
  end

  # Whether an actor with the given effective rank may manage an existing member
  # whose current role is +target_current_role+. A project_owner can manage rows
  # up to and including project_owner; org_owner/admin manage everything.
  def can_manage_project_member?(actor_rank, target_current_role)
    actor_rank >= rank("project_owner") &&
      actor_rank >= rank(target_current_role)
  end

  # Merges a requested role_scope into the current one, returning the resulting
  # scope hash (string keys, org ids as strings, deduplicated, sorted). Raises
  # when the request ADDS org ids outside the actor's reach. Org ids outside the
  # actor's reach are always preserved server-side (never removed by a non-admin).
  #
  # Semantics are "set with preservation": the requested scope is the desired
  # full set; in-reach additions/removals are honored, out-of-reach orgs are kept.
  # Only NEWLY ADDED orgs must be within the actor's reach — an org already in the
  # target's current scope may be removed by a peer (the only peer allowance).
  #
  #   actor_role:  the actor's account role ("admin"/"system" are unrestricted)
  #   actor_scope: the actor's own org ids (their reach)
  #   current:     the target's current role_scope (Hash, JSON string or nil)
  #   requested:   the requested role_scope (Hash, JSON string or nil)
  def merge_role_scope(actor_role:, actor_scope:, current:, requested:)
    current_orgs = normalize_orgs(current) || []
    requested_orgs = normalize_orgs(requested)

    return { "org" => current_orgs } if requested_orgs.nil?

    actor_orgs = Array(actor_scope).map(&:to_s)

    if admin?(actor_role)
      { "org" => requested_orgs.sort }
    else
      # Only orgs that are being ADDED (not already in the current scope) must be
      # within the actor's reach. Removing an org the actor already shares is a
      # peer allowance.
      outside = (requested_orgs - current_orgs) - actor_orgs
      raise Verse::Error::Unauthorized,
            "Cannot assign an organization outside your own organizations" unless outside.empty?

      # Preserve orgs outside the actor's reach; honor the in-reach request.
      preserved = current_orgs - actor_orgs
      { "org" => (requested_orgs | preserved).sort }
    end
  end

  # Whether the role is admin or system (unrestricted reach).
  def admin?(role_name)
    %w[admin system].include?(role_name.to_s)
  end

  # Normalizes a role_scope value (Hash, JSON string, Sequel JSONB object or nil)
  # to an array of string org ids. Returns nil only when the scope is entirely
  # absent (nil); an empty or org-less scope yields an empty array.
  def normalize_orgs(role_scope)
    return nil if role_scope.nil?

    scope = role_scope
    scope = JSON.parse(scope) if scope.is_a?(String)
    scope = scope.to_h if scope.respond_to?(:to_h) && !scope.is_a?(Hash)
    return [] unless scope.is_a?(Hash)

    Array(scope["org"] || scope[:org]).map(&:to_s)
  end
end