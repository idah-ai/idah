# frozen_string_literal: true

module Account
  class RoleChangeNotification
    attr_reader :from_role, :to_role, :email_title, :category, :email_params, :send_notification, :recipient_email, :recipient_id

    TRANSITION_SETTINGS = {
      ["user", "org_owner"] => {
        category: "upgrade_user_to_org_owner",
        send_notification: true,
        title: "You have been assigned as organization owner"
      },
      ["user", "admin"]     => { category: "upgrade_user_to_admin", send_notification: false },
      ["org_owner", "user"] => {
        category: "downgrade_org_owner_to_user",
        send_notification: true,
        title: "You have been removed as organization owner"
      },
      ["org_owner", "admin"]=> { category: "upgrade_org_owner_to_admin", send_notification: false },
      ["admin", "user"]     => { category: "downgrade_admin_to_user", send_notification: false },
      ["admin", "org_owner"]=> { category: "downgrade_admin_to_org_owner", send_notification: false },
    }.freeze


    def initialize(from_role:, to_role:, email_title: nil, email_params: {})
      @from_role = from_role
      @to_role = to_role
      settings = TRANSITION_SETTINGS[[from_role, to_role]] || {}

      @category = settings[:category] || default_category
      @send_notification = settings.fetch(:send_notification, false)
      @email_title = settings[:title] || default_title
      @email_params = email_params
      @recipient_email = email_params[:recipient_account_email]
      @recipient_id = email_params[:recipient_account_id]
    end

    def deliver!
      return unless send_notification

      ::Service::Notification.email(
        recipient_account_email: recipient_email,
        title: email_title,
        category: category,
        recipient_account_id: recipient_id,
        **email_params
      )
    end

    private

    def default_title
      "Your account role has changed from #{from_role} to #{to_role}"
    end

    def default_category
      "account_role_changed_from_#{from_role}_to_#{to_role}"
    end
  end
end