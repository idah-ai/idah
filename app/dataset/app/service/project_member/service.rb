# frozen_string_literal: true

module ProjectMember
  class Service < Verse::Service::Base
    use project_members: ProjectMember::Repository

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

      # With "as_user" access ensure account can "create" project member to the project
      if auth_context.can?(:create, project_members.class.resource) == :as_user &&
         ScopedQuery::Service.without_project_access?(
           auth_context.metadata[:id],
           record.project.id,
           ["project_owner"]
         )
        raise Verse::Error::Unauthorized,
              "You do not have permission to create project member on this project"
      end

      # Assign attributes
      attributes = record.attributes
      attributes[:project_id] = record.project.id

      project_members.transaction do
        record_id = project_members.create(record.attributes)
        member = project_members.find!(record_id, included: [:project])

        project_members.after_commit do
          member_account = Api[:idah].iam.accounts.show(id: member.account_id)

          # only send notification email if the account has joined already
          unless member_account.joined_at.nil?
            ::Service::Notification.email(
              recipient_account_email: member.email,
              title: "You have been assigned to the project '#{member.project.name}'",
              category: "project_member_added",
              project_id: member.project_id,
              project_name: member.project.name,
              inviter_email: Api[:idah].iam.accounts.show(id: member.invited_by_id).email
            )
          end
        end

        member
      end
    end

    def update(record)
      project_members.update!(record.id, record.attributes)
      project_members.find!(record.id)
    end

    def delete(id)
      project_members.transaction do
        member = project_members.find!(id, included: [:project])

        project_members.delete!(id)

        project_members.after_commit do
          ::Service::Notification.email(
            recipient_account_email: member.email,
            title: "You have been removed from the project '#{member.project.name}'",
            category: "project_member_removed",
            project_id: member.project_id,
            project_name: member.project.name,
            remover_email: "" # TO DO: get remover email from auth_context
          )
        end
      end
    end
  end
end
