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
        project_members.delete(id)

        project_members.after_commit do
          ::Service::Notification.email(
            recipient_account_email: member.email,
            title: "You have been removed from the project '#{member.project.name}'",
            category: "project_member_removed",
            project_id: member.project_id,
            project_name: member.project.name
          )
        end
      end
    end
  end
end
