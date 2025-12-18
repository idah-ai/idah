# frozen_string_literal: true

module Service
  module Notification
    module_function

    SEND_EMAIL_CHANNEL = "notification:email"

    def email(
      title:,
      category:,
      type: nil,
      to: nil,
      **params
    )
      raise ArgumentError, "to email must be provided" if to.nil?

      hash = {
        account_email: to,
        title:,
        category:,
        type:
      }.merge(params)

      Verse.logger.debug { "Send email: #{hash}" }
      Verse.publish(SEND_EMAIL_CHANNEL, hash)
    end
  end
end
