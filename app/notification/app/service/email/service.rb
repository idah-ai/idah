# frozen_string_literal: true

require "mail"
require "uri"

module Email
  class Service < Verse::Service::Base
    def send_email(to_email, notification)
      unless to_email.is_a?(String) && to_email.match?(URI::MailTo::EMAIL_REGEXP)
        raise Verse::Error::ValidationFailed, "Invalid to_email: #{to_email.inspect}"
      end

      account = Api[:idah].iam.accounts.index(
        {
          filter: { email: to_email }
        }
      ).data.first

      unless account
        raise Verse::Error::NotFound, "Account not found for email: #{to_email}"
      end

      send_email_categories =
        Api[:idah].setting.account_settings.index(
          {
            filter: { account_id: account.id }
          }
        ).data.map{ |s| [s.key, s.value] }.to_h

      send_email = send_email_categories.fetch(
        notification.type, true
      )

      return unless send_email

      mail = Mail.new do
        from    ENV.fetch("MAIL_FROM", "Idah Notification <no-reply@idah.ingedata.ai>")
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

      begin
        Mail.deliver(mail)
      rescue StandardError => e
        Verse.logger&.error do
          "email delivery failed: [#{e.class}] #{e.message} " \
            "(to=#{to_email}, category=#{notification.category})"
        end
        raise
      end
    end
  end
end
