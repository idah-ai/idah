# frozen_string_literal: true

module ProjectMember
  class Service < Verse::Service::Base
    use project_members: ProjectMember::Repository,
        projects: Project::Repository

    use_system system_project_members: ProjectMember::Repository,
               system_entries: Entry::Repository

    def index(filter = {}, included: [], page: 1, items_per_page: 1000, sort: nil, query_count: false)
      project_members.index(
        filter,
        included:,
        page:,
        items_per_page:,
        sort:,
        query_count:
      )
    end

    def show(id, included: [])
      project_members.find!(id, included: included)
    end

    def create(record)
      # Validate required relationships
      unless record.project
        raise Verse::Error::ValidationFailed,
              "project relationship is required to create a project member"
      end

      authorize_creation(
        record.attributes[:role],
        record.project.id,
        auth_context.can?(:create, project_members.class.resource)
      )

      # Assign attributes
      attributes = record.attributes
      attributes[:project_id] = record.project.id

      project_members.transaction do
        record_id = project_members.create(attributes)
        member = project_members.find!(record_id, included: [:project])

        project_members.after_commit do
          member_account = Api[:idah].iam.accounts.show(id: member.account_id)
          inviter = Api[:idah].iam.accounts.show(id: member.invited_by_id)

          # only send notification email if the account has joined already
          unless member_account.joined_at.nil?
            ::Service::Notification.email(
              to: member.email,
              title: "You have been assigned to the project '#{member.project.name}'",
              category: "project_member_added",
              type: "notification:project:activities",
              project_id: member.project_id,
              project_name: member.project.name,
              inviter_email: inviter.email,
              inviter_name: inviter.name
            )
          end
        end

        member
      end
    end

    private def authorize_creation(creating_role, project_id, access)
      case access
      when :as_org_owner
        begin
          projects.find!(project_id)
        rescue Verse::Error::RecordNotFound # if it can't be found then we assume it's not in org_owner's scope
          raise Verse::Error::Unauthorized,
                "You do not have permission to create a project member for this project"
        end
      when :as_user
        if creating_role == "project_owner"
          raise Verse::Error::Unauthorized,
                "You do not have permission to create a project owner member for this project"
        end

        if ScopedQuery::Service.without_project_access?(
          auth_context.metadata[:id],
          project_id,
          ["project_owner"]
        )
          raise Verse::Error::Unauthorized,
                "You do not have permission to create project member on this project"
        end
      end
    end

    def update(record)
      access = auth_context.can?(:update, project_members.class.resource)
      # "project_owner" can only be added by an org_owner of the project
      if record.attributes[:role] == "project_owner"
        unless access == :as_org_owner
          raise Verse::Error::Unauthorized,
                "You do not have permission to update a member for this project"
        end

        project = projects.find!(record.project.id) # this can raise Verse::Error::RecordNotFound if not in org scope
        unless auth_context.custom_scopes[:org]&.include?(project.organization_id.to_s)
          raise Verse::Error::Unauthorized,
                "You do not have permission to update a member to a project owner for this project"
        end
      end

      project_members.update!(record.id, record.attributes)
      project_members.find!(record.id)
    end

    def delete(id)
      project_members.transaction do
        member = project_members.find!(id, included: [:project])
        project_members.delete!(id)

        remover = Api[:idah].iam.accounts.show(id: auth_context.metadata[:id])

        project_members.after_commit do
          ::Service::Notification.email(
            to: member.email,
            title: "You have been removed from the project '#{member.project.name}'",
            category: "project_member_removed",
            type: "notification:project:activities",
            project_id: member.project_id,
            project_name: member.project.name,
            remover_email: remover.email,
            remover_name: remover.name,
          )
        end
      end
    end

    # remove only memberships that haven't assigned to or worked on any entry in each project
    def remove_nonparticipant_member(account_id)
      member_project_ids = system_project_members.index({ account_id: account_id }).map(&:project_id).uniq
      participated_project_ids = system_entries.index(
        {
          participated: account_id,
          project_id: member_project_ids
        }
      ).map(&:project_id).uniq

      non_participated_project_ids = member_project_ids - participated_project_ids

      return unless non_participated_project_ids

      non_participated_project_ids.each do |project_id|
        membership = project_members.find_by({ account_id: account_id, project_id: project_id })

        # directly delete, no need use service delete to send a notification as the account is already deleted
        project_members.delete!(membership.id) if membership
      end
    end
  end
end
