# frozen_string_literal: true

require "mail"

module Email
  class Service < Verse::Service::Base
    def send_email(to_email, notification)
      account = Api[:idah].iam.accounts.index(
        {
          filter: { email: to_email }
        }
      ).data.first

      unless account
        raise Verse::Error::NotFound, "Account not found for email: #{to_email}"
      end

      mail = Mail.new do
        from    "Idah Notification <no-reply@idah.ingedata.ai>"
        to      to_email
        subject notification.title
      end

      renderer = Email::Renderer.new(account, notification)

      mail.text_part = Mail::Part.new do
        body renderer.render_text
      end

      mail.html_part = Mail::Part.new do
        content_type "text/html; charset=UTF-8"
        body renderer.render_html
      end

      Mail.deliver(mail)
    end
  end
end
