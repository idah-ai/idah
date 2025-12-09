# frozen_string_literal: true

module Service
  module Notification
    module_function

    SEND_EMAIL_CHANNEL = "notification:email"

    def email(
      title:,
      category:,
      recipient_account_email: nil,
      **params
    )
      if recipient_account_email.nil?
        raise ArgumentError, "recipient_account_email must be provided"
      end

      hash = {
        account_email: recipient_account_email,
        title:,
        category:,
      }.merge(params)

      Verse.logger.debug { "Send email: #{hash}" }
      Verse.publish(SEND_EMAIL_CHANNEL, hash)
    end
  end
end
