# frozen_string_literal: true

module Email
  # Email notifications are sent only when an SMTP host is configured.
  # Without MAIL_SMTP_HOST the service boots normally and skips emails.
  def self.enabled?
    @enabled
  end

  def self.enabled=(value)
    @enabled = value
  end
end

smtp_host = ENV["MAIL_SMTP_HOST"].to_s.strip

case ENV["APP_ENVIRONMENT"]
when "test"
  Email.enabled = true
when "production", "staging"
  Email.enabled = !smtp_host.empty?

  if Email.enabled?
    smtp_user = ENV["MAIL_SMTP_USER"].to_s
    smtp_options = {
      address: smtp_host,
      port: ENV.fetch("MAIL_SMTP_PORT", 587).to_i,
      enable_starttls_auto: true
    }

    unless smtp_user.empty?
      smtp_options.merge!(
        user_name: smtp_user,
        password: ENV["MAIL_SMTP_PASSWORD"],
        authentication: "login"
      )
    end

    Mail.defaults { delivery_method(:smtp, smtp_options) }
  end
when "development"
  Email.enabled = !smtp_host.empty?

  if Email.enabled?
    smtp_options = {
      address: smtp_host,
      port: ENV.fetch("MAIL_SMTP_PORT", 1025).to_i
    }

    Mail.defaults { delivery_method(:smtp, smtp_options) }
  end
else
  Email.enabled = false
end

unless Email.enabled?
  Verse.logger ||= Logger.new($stdout)
  Verse.logger.info{ "Email notifications disabled: MAIL_SMTP_HOST is not set" }
end
