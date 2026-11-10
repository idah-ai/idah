# frozen_string_literal: true

require "mail"

module Email
  class Service < Verse::Service::Base
    # Without SMTP (no MAIL_SMTP_HOST) the email is written to the log instead,
    # so an administrator can still pass on invitation and password links.
    def send_email(to_email, notification)
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
        from    "Idah Notification <no-reply@idah.ingedata.ai>"
        to      to_email
        subject notification.title
      end

      renderer = Email::Renderer.new(account, notification)
      text = renderer.render_text

      unless Email.enabled?
        log_instead_of_sending(to_email, notification.title, text)
        return
      end

      mail.text_part = Mail::Part.new do
        body text
      end

      mail.html_part = Mail::Part.new do
        content_type "text/html; charset=UTF-8"
        body renderer.render_html
      end

      Mail.deliver(mail)
    end

    private

    # The text body carries the same links as the HTML one, and reads in a log.
    def log_instead_of_sending(to_email, subject, text)
      Verse.logger.info(
        <<~LOG
          Email not sent, SMTP is not configured (set MAIL_SMTP_HOST to send it):
          To: #{to_email}
          Subject: #{subject}

          #{text}
        LOG
      )
    end
  end
end
