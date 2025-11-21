# frozen_string_literal: true

class EmailsExpo < BaseExpo
  use_service Email::Service

  expose on_event(Service::Notification::SEND_EMAIL_CHANNEL)
  def on_send_email
    content = message.content

    unless content[:account_email]
      raise Verse::Error::ValidationFailed, "Missing account_email in email content"
    end

    notify = Verse::JsonApi::Struct.new(content)
    service.send_email(
      notify.account_email,
      notify
    )
  end
end
