# frozen_string_literal: true

case ENV["APP_ENVIRONMENT"]
when "production", "staging"
  Mail.defaults do
    delivery_method(
      :smtp,
      address: ENV.fetch("MAIL_SMTP_HOST"),
      port: ENV.fetch("MAIL_SMTP_PORT"),
      user_name: ENV.fetch("MAIL_SMTP_USER"),
      password: ENV.fetch("MAIL_SMTP_PASSWORD"),
      authentication: "login",
      enable_starttls_auto: true
    )
  end
when "development"
  Mail.defaults do
    delivery_method(
      :smtp,
      address: ENV.fetch("MAIL_SMTP_HOST"),
      port: ENV.fetch("MAIL_SMTP_PORT"),
    )
  end
end
