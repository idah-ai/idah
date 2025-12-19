# frozen_string_literal: true

module Account
  class RoleChangeNotification < Verse::Service::Base
    use_system organization_repo: Organization::Repository

    attr_reader :previous_account,
                :updated_account,
                :from_role,
                :to_role,
                :default_email_params

    TRANSITION_SETTINGS = {
      ["user", "org_owner"] => {
        category: "org_owner_role_assigned",
        type: "notification:organization:activities",
        send_notification: true,
        title: "You have been assigned as organization owner"
      },
      ["user", "admin"] => {
        category: "upgrade_user_to_admin",
        send_notification: false
      },
      ["org_owner", "user"] => {
        category: "org_owner_role_removed",
        type: "notification:organization:activities",
        send_notification: true,
        title: "You have been removed as organization owner"
      },
      ["org_owner", "org_owner"] => {
        category: "org_owner_role_assigned",
        type: "notification:organization:activities",
        send_notification: true,
        title: "Your organization scope has been changed"
      },
      ["org_owner", "admin"] => {
        category: "upgrade_org_owner_to_admin",
        type: "notification:organization:activities",
        send_notification: false
      },
      ["admin", "user"] => {
        category: "downgrade_admin_to_user",
        send_notification: false
      },
      ["admin", "org_owner"] => {
        category: "downgrade_admin_to_org_owner",
        type: "notification:organization:activities",
        send_notification: false
      },
    }.freeze

    def deliver!(previous_account:, updated_account:)
      @previous_account = previous_account
      @updated_account = updated_account

      @from_role = previous_account.role_name
      @to_role = updated_account.role_name

      settings = TRANSITION_SETTINGS[[from_role, to_role]] || {}
      @default_email_params = {
        to: previous_account.email,
        title: settings[:title] || default_title,
        category: settings[:category] || default_category,
        type: settings[:type] || "notification:account:activities",
        recipient_account_email: previous_account.email,
        recipient_account_id: previous_account.id,
        changed_by_name: auth_context.metadata[:name]
      }

      return unless settings.fetch(:send_notification, false)

      if to_role == "org_owner" || from_role == "org_owner" && to_role != "org_owner"
        org_owner_notify_email!
        return
      end

      default_notify_email!
    end

    private

    def default_notify_email!
      ::Service::Notification.email(**default_email_params)
    end

    def default_title
      "Your account role has changed from #{from_role} to #{to_role}"
    end

    def default_category
      "account_role_changed_from_#{from_role}_to_#{to_role}"
    end

    def org_owner_notify_email!
      previous_orgs = previous_account.role_scope["org"] || []
      updated_orgs = updated_account.role_scope["org"] || []

      new_org_ids = updated_orgs - previous_orgs
      removed_org_ids = previous_orgs - updated_orgs

      org_owner_changed_notify_email!(new_org_ids, "added") if new_org_ids.any?
      org_owner_changed_notify_email!(removed_org_ids, "removed") if removed_org_ids.any?
    end

    def org_owner_changed_notify_email!(org_ids, action)
      org_ids.each do |org_id|
        organization = organization_repo.find(org_id)

        ::Service::Notification.email(
          **default_email_params.merge(
            organization_id: organization.id,
            organization_name: organization.name,
            organization_scope_change: action
          )
        )
      end
    end
  end
end
