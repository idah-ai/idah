# frozen_string_literal: true

module Project
  class Service < Verse::Service::Base
    use projects: Project::Repository
    use_system system_datasets: Dataset::Repository

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      projects.index(
        filter,
        included: included,
        page: page,
        items_per_page: items_per_page,
        sort: sort,
        query_count: query_count
      )
    end

    def show(id, included: [])
      projects.find!(id, included: included)
    end

    def create(record)
      authorize_creation(record.attributes[:organization_id].to_s)

      attributes = record.attributes
      attributes[:id] = record.id || UUIDv7.generate
      attributes[:created_by_email] = auth_context.metadata[:email]
      attributes[:storage_target_id] = presence(attributes[:storage_target_id])

      check_storage_target!(attributes[:storage_target_id], attributes[:organization_id])

      projects.transaction do
        id = projects.create(attributes)
        projects.find!(id)
      end
    end

    # Project creation is organization-level: only admin/system, or an org_owner
    # creating within one of their own organizations, may create a project. A
    # project_owner membership does not grant project-creation rights.
    def authorize_creation(organization_id)
      auth_context.can!(:create, projects.class.resource) do |scope|
        scope.all? { true }

        scope.as_org_owner? do
          unless auth_context.custom_scopes[:org]&.include?(organization_id.to_s)
            raise Verse::Error::Unauthorized, "You do not have permission to create this project"
          end

          true
        end

        scope.else? do
          raise Verse::Error::Unauthorized, "You do not have permission to create this project"
        end
      end
    end

    def update(record)
      refuse_storage_target_change!(record)
      authorize_organization_move(record)

      projects.update!(record.id, record.attributes)
      projects.find!(record.id)
    end

    # organization_id is readonly on Project::Record, so JSON:API PATCH already
    # drops it. This guard is defense in depth: if a caller still tries to move a
    # project to another organization, only admin/system (or an org_owner who
    # owns both the current and the target organization) may do so.
    def authorize_organization_move(record)
      return unless record.attributes.key?(:organization_id)

      current_org = projects.find!(record.id, scope: projects.scoped(:update)).organization_id
      new_org = record.attributes[:organization_id]
      return if new_org.to_s == current_org.to_s

      auth_context.can!(:update, projects.class.resource) do |scope|
        scope.all? { true }

        scope.as_org_owner? do
          org_ids = auth_context.custom_scopes[:org]
          unless org_ids&.include?(current_org.to_s) && org_ids.include?(new_org.to_s)
            raise Verse::Error::Unauthorized,
                  "You do not have permission to move this project to another organization"
          end

          true
        end

        scope.else? do
          raise Verse::Error::Unauthorized,
                "You do not have permission to move this project to another organization"
        end
      end

      check_storage_target_allows_move!(record.id, new_org)
    end

    # The project's storage target, for showing it to the project's members:
    # name and location, never credentials. An archived target is still named
    # by its id. Nil for the default storage.
    def storage_target_summary(project)
      return unless project.storage_target_id

      target = StorageTargetLookup.find(project.storage_target_id)
      return { id: project.storage_target_id, archived: true } unless target

      { id: target.id, name: target.name, endpoint: target.endpoint, bucket: target.bucket }
    end

    private def presence(value)
      value.to_s.strip.empty? ? nil : value
    end

    # A project may only be created in an enabled target that allows its
    # organization. Asked fresh, so a target disabled a moment ago is refused.
    private def check_storage_target!(target_id, organization_id)
      return if target_id.nil?

      target = StorageTargetLookup.find(target_id, fresh: true)
      return if target&.enabled && target.organization_ids.include?(organization_id.to_i)

      raise Verse::Error::ValidationFailed,
            "storage target `#{target_id}` can't be used for a project of this organization"
    end

    # The target is chosen once: its files would otherwise be split between two
    # storages. Sending the current value back, as a form does, is fine.
    private def refuse_storage_target_change!(record)
      return unless record.attributes.key?(:storage_target_id)

      current = projects.find!(record.id, scope: projects.scoped(:update)).storage_target_id
      return if presence(record.attributes[:storage_target_id]) == current

      raise Verse::Error::ValidationFailed, "storage_target_id can't be changed once the project exists"
    end

    # A project kept in a dedicated storage target may only move to an
    # organization that target allows: otherwise one customer's files would sit
    # in another customer's bucket.
    private def check_storage_target_allows_move!(project_id, new_org)
      target_id = projects.find!(project_id, scope: projects.scoped(:update)).storage_target_id
      return if target_id.nil?

      target = StorageTargetLookup.find(target_id, fresh: true)
      return if target&.organization_ids&.include?(new_org.to_i)

      raise Verse::Error::ValidationFailed,
            "the project's storage target doesn't allow organization #{new_org}"
    end

    def delete(id)
      # Check if atleast 1 dataset is in-progress or completed
      dataset = system_datasets.find_by({ project_id: id, status: %w[in_progress completed] })
      if dataset
        raise Verse::Error::Unauthorized,
              "Unable to delete project with in progress or completed datasets"
      end

      projects.delete!(id)
    end
  end
end
