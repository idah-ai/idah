# frozen_string_literal: true

module Access
  # Answers whether accounts may perform an action on rows of dataset resources,
  # using the repository's own scope for that action. System-only; each principal
  # is { account_id:, role_name:, role_scope: }. Only account ids are returned.
  class Service < Verse::Service::Base
    REPOSITORIES = {
      Resource::Dataset::Projects => Project::Repository,
      Resource::Dataset::ProjectMembers => ProjectMember::Repository,
      Resource::Dataset::Datasets => Dataset::Repository,
      Resource::Dataset::Entries => Entry::Repository
    }.freeze

    # Rule "allowed": the account may perform `action` on the row `id` of `resource`.
    # `own_account_id` also allows that account when it can read the row (the
    # member an event is about). Returns the allowed account ids.
    def check(rule:, principals:, action:, resource:, id:, own_account_id: nil)
      auth_context.can!(:check, Resource::Dataset::AccessChecks) { |scope| scope.all? { true } }

      unless rule.to_s == "allowed"
        raise Verse::Error::ValidationFailed, "unknown rule `#{rule}`"
      end

      repository = REPOSITORIES.fetch(resource) do
        raise Verse::Error::ValidationFailed, "unknown resource `#{resource}`"
      end

      principals.map { |principal| principal.to_h.transform_keys(&:to_sym) }.filter_map do |principal|
        context = AuthContextBuilder.build(**principal.slice(:account_id, :role_name, :role_scope))
        principal[:account_id] if allowed?(repository, context, action, id) ||
                                  own?(repository, context, principal, id, own_account_id)
      end
    end

    private

    def allowed?(repository, context, action, id)
      repository.new(context).scoped(action.to_sym).where(id:).select(1).limit(1).any?
    rescue Verse::Error::Unauthorized
      false
    end

    def own?(repository, context, principal, id, own_account_id)
      own_account_id && own_account_id.to_s == principal[:account_id].to_s &&
        allowed?(repository, context, :read, id)
    end
  end
end
