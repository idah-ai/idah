# frozen_string_literal: true

module Service
  module Notification
    module_function

    SEND_EMAIL_CHANNEL = "notification:email"

    def email(
      title:,
      category:,
      to: nil,
      **params
    )
      if to.nil?
        raise ArgumentError, "to email must be provided"
      end

      hash = {
        account_email: to,
        title:,
        category:,
      }.merge(params)

      Verse.logger.debug { "Send email: #{hash}" }
      Verse.publish(SEND_EMAIL_CHANNEL, hash)
    end
  end
end
